import type { IncomingMessage, ServerResponse } from 'node:http'
import { RouteError } from './errors.js'
import { detectForge, parseRemoteLocation } from './forge/detect.js'
import { readForgeLogin } from './forge/index.js'
import { resolveRemote } from './forge/remote.js'
import { clearForgeTokenCache } from './forge/token.js'
import { gitFailure, runGit, runGitWithInput } from './git.js'
import { admitHeaders, failure, json } from './http.js'
import { resolveRepository } from './repository.js'
import type { RouteContext } from './types.js'

interface CredentialBody {
  path?: unknown
  remote?: unknown
  username?: unknown
  password?: unknown
  /** Store a forge token even when the remote itself uses SSH. */
  forge?: unknown
}

const MAX_BODY_BYTES = 16 * 1024
const MAX_FIELD = 512

function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name]
  if (value === undefined) return null
  return Array.isArray(value) ? value.join(', ') : value
}

async function readJson(req: IncomingMessage): Promise<CredentialBody> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new RouteError(413, 'body-too-large', 'The request body is too large.')
    chunks.push(buffer)
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object')
    return parsed as CredentialBody
  } catch {
    throw new RouteError(400, 'invalid-body', 'The request body must be a JSON object.')
  }
}

async function send(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })
  res.end(Buffer.from(await response.arrayBuffer()))
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Split an https remote URL into the host and the optional path git may match on. */
function httpsTarget(url: string): { protocol: string; host: string; path: string } | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    return { protocol: parsed.protocol.replace(':', ''), host: parsed.host, path: parsed.pathname.replace(/^\/+/, '') }
  } catch {
    return null
  }
}

/**
 * Where an HTTPS credential should be stored. A forge token is also valid for
 * an SSH remote, because the token is used against the web API, not the SSH
 * transport; the host is then taken from the SSH remote.
 */
function credentialTarget(
  url: string,
  allowSsh: boolean,
  projectPath: string | null,
): { protocol: string; host: string; path: string } | null {
  const https = httpsTarget(url)
  if (https !== null) {
    // A forge token is used against the HTTPS API even when the remote is HTTP.
    return { protocol: allowSsh ? 'https' : https.protocol, host: https.host, path: projectPath ?? https.path }
  }
  if (!allowSsh) return null
  const location = parseRemoteLocation(url)
  if (location === null) return null
  return { protocol: 'https', host: location.host, path: projectPath ?? location.path }
}

/**
 * POST /git-suite/credential: store an HTTPS username/token through the OS
 * credential helper (`git credential approve`), so later fetches just work.
 * Secrets only travel on git's stdin and are never echoed back.
 */
export function createCredentialHandler(context: RouteContext): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (!admitHeaders(name => header(req, name))) {
      await send(res, json({
        ok: false,
        error: { code: 'forbidden', message: 'This request is not allowed to change credentials.' },
      }, 403))
      return
    }
    if (req.method !== 'POST') {
      await send(res, json({
        ok: false,
        error: { code: 'method-not-allowed', message: 'Saving credentials requires POST.' },
      }, 405))
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    res.once('close', () => controller.abort())
    try {
      const body = await readJson(req)
      let username = text(body.username)
      const password = typeof body.password === 'string' ? body.password : ''
      const forgeRequest = body.forge === true
      if (password === '') {
        throw new RouteError(400, 'credential-required', 'Enter a password or access token.')
      }
      if (username.length > MAX_FIELD || password.length > MAX_FIELD) {
        throw new RouteError(400, 'credential-too-long', 'That credential is too long.')
      }

      const repo = await resolveRepository(context, text(body.path), controller.signal)
      const remote = text(body.remote) === '' ? 'origin' : text(body.remote)
      let url = ''
      try {
        // For a forge token the configured URL decides the API host; for an
        // ordinary credential the rewritten URL is what git will authenticate to.
        url = forgeRequest
          ? (await resolveRemote(repo.root, remote, controller.signal)).url
          : (await runGit(repo.root, ['remote', 'get-url', remote], controller.signal)).trim()
      } catch (error) {
        if (error instanceof RouteError) throw error.withDetails({ remote })
        throw gitFailure(error).withDetails({ remote })
      }
      const forgeTarget = forgeRequest ? detectForge(url) : null
      const target = credentialTarget(url, forgeRequest, forgeTarget?.projectPath ?? null)
      if (target === null) {
        const message = forgeRequest
          ? 'This remote has no forge host that could store a credential.'
          : 'Only HTTPS remotes keep a stored credential; this one uses SSH or a local path.'
        throw new RouteError(400, forgeRequest ? 'unsupported-remote' : 'not-https', message, { remote })
      }

      if (username === '') {
        if (!forgeRequest) {
          throw new RouteError(400, 'credential-required', 'Enter both a username and a password or token.')
        }
        // Gitee needs the real account name, not a placeholder; resolve it from
        // the token. A token without the user scope still falls back.
        const login = forgeTarget === null ? null : await readForgeLogin(forgeTarget, password, controller.signal)
        username = login ?? (forgeTarget?.provider === 'gitlab' ? 'oauth2' : 'token')
      }
      if (username.length > MAX_FIELD) {
        throw new RouteError(400, 'credential-too-long', 'That credential is too long.')
      }

      // Without a helper, `git credential approve` stores nothing.
      let helpers: string[] = []
      try {
        const values = (await runGit(repo.root, ['config', '--get-all', 'credential.helper'], controller.signal))
          .split(/\r?\n/)
          .map(item => item.trim())
        // The final newline produces one phantom empty value; keep real ones.
        if (values.length > 0 && values[values.length - 1] === '') values.pop()
        // An empty value resets the helper list, exactly as git resolves it.
        for (const value of values) {
          if (value === '') helpers = []
          else helpers.push(value)
        }
      } catch {
        helpers = []
      }
      if (helpers.length === 0) {
        throw new RouteError(409, 'no-credential-helper', 'This repository has no credential helper, so the credential cannot be stored.', { remote })
      }
      let useHttpPath = false
      try {
        useHttpPath = (await runGit(repo.root, ['config', '--get', 'credential.useHttpPath'], controller.signal)).trim() === 'true'
      } catch {
        useHttpPath = false
      }

      const lines = [`protocol=${target.protocol}`, `host=${target.host}`]
      if (useHttpPath && target.path !== '') lines.push(`path=${target.path}`)
      lines.push(`username=${username}`, `password=${password}`, '')
      try {
        await runGitWithInput(repo.root, ['credential', 'approve'], `${lines.join('\n')}\n`, controller.signal)
      } catch (error) {
        throw gitFailure(error).withDetails({ remote, helper: helpers.join(', ') })
      }
      if (forgeRequest) clearForgeTokenCache()

      await send(res, json({ ok: true, remote, helper: helpers.join(', '), host: target.host }))
    } catch (error) {
      if (error instanceof RouteError) {
        await send(res, failure(error))
        return
      }
      await send(res, failure(new RouteError(500, 'internal', error instanceof Error ? error.message : String(error))))
    } finally {
      clearTimeout(timeout)
    }
  }
}




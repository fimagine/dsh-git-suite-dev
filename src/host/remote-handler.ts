import type { IncomingMessage, ServerResponse } from 'node:http'
import { RouteError } from './errors.js'
import { gitFailure, runGit } from './git.js'
import { admitHeaders, failure, json } from './http.js'
import { resolveRepository } from './repository.js'
import { isSupportedRemote } from './remote-url.js'
import type { RouteContext } from './types.js'

interface RemoteBody {
  action?: unknown
  path?: unknown
  name?: unknown
  newName?: unknown
  url?: unknown
}

const MAX_BODY_BYTES = 16 * 1024

function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name]
  if (value === undefined) return null
  return Array.isArray(value) ? value.join(', ') : value
}

async function readJson(req: IncomingMessage): Promise<RemoteBody> {
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
    return parsed as RemoteBody
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

async function listRemotes(root: string, signal: AbortSignal): Promise<string[]> {
  return (await runGit(root, ['remote'], signal))
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(item => item !== '')
}

/** POST /git-suite/remote: add or remove one configured remote. */
export function createRemoteHandler(context: RouteContext): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (!admitHeaders(name => header(req, name))) {
      await send(res, json({
        ok: false,
        error: { code: 'forbidden', message: 'This request is not allowed to modify the repository.' },
      }, 403))
      return
    }
    if (req.method !== 'POST') {
      await send(res, json({
        ok: false,
        error: { code: 'method-not-allowed', message: 'Remote actions require POST.' },
      }, 405))
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60_000)
    res.once('close', () => controller.abort())
    try {
      const body = await readJson(req)
      const action = typeof body.action === 'string' ? body.action : 'remove'
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (name === '') throw new RouteError(400, 'remote-required', 'Enter a remote name.')
      if (name.includes('\0') || /[\r\n\s]/.test(name) || name.startsWith('-')) {
        throw new RouteError(400, 'invalid-remote', 'That remote name is not valid.')
      }
      const repo = await resolveRepository(context, typeof body.path === 'string' ? body.path : '', controller.signal)

      if (action === 'add') {
        const url = typeof body.url === 'string' ? body.url.trim() : ''
        if (!isSupportedRemote(url)) {
          throw new RouteError(400, 'invalid-url', 'Enter a supported Git remote URL (https, ssh, git, file, or a local path).')
        }
        if ((await listRemotes(repo.root, controller.signal)).includes(name)) {
          throw new RouteError(409, 'remote-exists', 'A remote with that name already exists.', { name })
        }
        try {
          await runGit(repo.root, ['remote', 'add', name, url], controller.signal)
        } catch (error) {
          throw gitFailure(error)
        }
        await send(res, json({ ok: true, action, name, url }))
        return
      }

      if (action === 'set-url') {
        const url = typeof body.url === 'string' ? body.url.trim() : ''
        if (!isSupportedRemote(url)) {
          throw new RouteError(400, 'invalid-url', 'Enter a supported Git remote URL (https, ssh, git, file, or a local path).')
        }
        const nextName = typeof body.newName === 'string' ? body.newName.trim() : ''
        const rename = nextName !== '' && nextName !== name
        if (rename && (nextName.includes('\0') || /[\r\n\s]/.test(nextName) || nextName.startsWith('-'))) {
          throw new RouteError(400, 'invalid-remote', 'That remote name is not valid.', { name: nextName })
        }
        const remotes = await listRemotes(repo.root, controller.signal)
        if (!remotes.includes(name)) {
          throw new RouteError(404, 'remote-not-found', 'That remote is not configured in this repository.', { name })
        }
        let target = name
        if (rename) {
          if (remotes.includes(nextName)) {
            throw new RouteError(409, 'remote-exists', 'A remote with that name already exists.', { name: nextName })
          }
          try {
            await runGit(repo.root, ['remote', 'rename', name, nextName], controller.signal)
          } catch (error) {
            throw gitFailure(error).withDetails({ name, newName: nextName })
          }
          target = nextName
        }
        try {
          await runGit(repo.root, ['remote', 'set-url', target, url], controller.signal)
        } catch (error) {
          throw gitFailure(error)
        }
        await send(res, json({ ok: true, action, name: target, url }))
        return
      }

      if (action === 'remove') {
        if (!(await listRemotes(repo.root, controller.signal)).includes(name)) {
          throw new RouteError(404, 'remote-not-found', 'That remote is not configured in this repository.', { name })
        }
        try {
          await runGit(repo.root, ['remote', 'remove', name], controller.signal)
        } catch (error) {
          throw gitFailure(error)
        }
        await send(res, json({ ok: true, action, name }))
        return
      }

      throw new RouteError(400, 'invalid-action', 'Unknown remote action.')
    } catch (error) {
      await send(res, failure(error))
    } finally {
      clearTimeout(timeout)
    }
  }
}

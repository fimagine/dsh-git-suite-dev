import type { IncomingMessage, ServerResponse } from 'node:http'
import { RouteError } from './errors.js'
import { gitFailure, runGit } from './git.js'
import { admitHeaders, failure, json } from './http.js'
import { resolveRepository } from './repository.js'
import type { RouteContext } from './types.js'

interface SyncBody {
  action?: unknown
  path?: unknown
  remote?: unknown
  branch?: unknown
  refs?: unknown
  tags?: unknown
  force?: unknown
  fetchAll?: unknown
  prune?: unknown
  forceTags?: unknown
}

const MAX_BODY_BYTES = 64 * 1024

function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name]
  if (value === undefined) return null
  return Array.isArray(value) ? value.join(', ') : value
}

async function readJson(req: IncomingMessage): Promise<SyncBody> {
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
    return parsed as SyncBody
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

/** POST /git-suite/sync: fetch all remotes, or pull/push one remote branch. */
export function createSyncHandler(context: RouteContext): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
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
        error: { code: 'method-not-allowed', message: 'Sync actions require POST.' },
      }, 405))
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120_000)
    res.once('close', () => controller.abort())
    try {
      const body = await readJson(req)
      const action = text(body.action)
      const repo = await resolveRepository(context, text(body.path), controller.signal)

      if (action === 'fetch') {
        const args = [
          'fetch',
          ...(body.fetchAll === true ? ['--all'] : []),
          ...(body.prune === true ? ['--prune'] : []),
          ...(body.tags === true ? ['--tags'] : []),
          ...(body.forceTags === true ? ['--force'] : []),
        ]
        await runGit(repo.root, args, controller.signal)
        await send(res, json({ ok: true, action }))
        return
      }

      if (action !== 'pull' && action !== 'push') {
        throw new RouteError(400, 'invalid-action', 'Unknown sync action.')
      }
      const remote = text(body.remote)
      if (remote === '') {
        throw new RouteError(400, 'remote-required', 'Choose a remote.')
      }
      const remotes = (await runGit(repo.root, ['remote'], controller.signal))
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(item => item !== '')
      if (!remotes.includes(remote)) {
        throw new RouteError(400, 'unknown-remote', 'That remote is not configured in this repository.', { remote })
      }

      if (action === 'pull') {
        const branch = text(body.branch)
        if (branch === '') {
          throw new RouteError(400, 'branch-required', 'Choose a branch.')
        }
        try {
          await runGit(repo.root, ['check-ref-format', '--branch', branch], controller.signal)
        } catch {
          throw new RouteError(400, 'invalid-branch', 'That branch name is not valid.', { branch })
        }
        try {
          await runGit(repo.root, ['pull', remote, branch], controller.signal)
        } catch (error) {
          throw gitFailure(error)
        }
        await send(res, json({ ok: true, action, remote, branch }))
        return
      }

      const rawRefs = Array.isArray(body.refs) ? body.refs : []
      const refs: { local: string; remote: string; track: boolean }[] = []
      for (const item of rawRefs) {
        if (typeof item !== 'object' || item === null) continue
        const record = item as Record<string, unknown>
        const local = text(record.local)
        const target = text(record.remote)
        if (local === '' || target === '') continue
        refs.push({ local, remote: target, track: record.track === true })
      }
      const tags = body.tags === true
      const force = body.force === true
      if (refs.length === 0 && !tags) {
        throw new RouteError(400, 'no-refs', 'Select at least one branch or all tags to push.')
      }
      for (const ref of refs) {
        try {
          await runGit(repo.root, ['check-ref-format', '--branch', ref.local], controller.signal)
          await runGit(repo.root, ['check-ref-format', '--branch', ref.remote], controller.signal)
        } catch {
          throw new RouteError(400, 'invalid-branch', 'A branch name is not valid.', { branch: ref.local })
        }
      }
      try {
        for (const ref of refs) {
          await runGit(repo.root, [
            'push',
            ...(force ? ['--force'] : []),
            ...(ref.track ? ['--set-upstream'] : []),
            remote,
            `${ref.local}:${ref.remote}`,
          ], controller.signal)
        }
        if (tags) {
          await runGit(repo.root, ['push', ...(force ? ['--force'] : []), remote, '--tags'], controller.signal)
        }
      } catch (error) {
        throw gitFailure(error)
      }
      await send(res, json({ ok: true, action, remote }))
    } catch (error) {
      await send(res, failure(error))
    } finally {
      clearTimeout(timeout)
    }
  }
}

import type { IncomingMessage, ServerResponse } from 'node:http'
import { isAbsolute, relative, resolve } from 'node:path'
import { RouteError } from './errors.js'
import { gitFailure, runGit } from './git.js'
import { admitHeaders, failure, json } from './http.js'
import { resolveRepository } from './repository.js'
import { detectOperation } from './routes/operation.js'
import type { RouteContext } from './types.js'

interface CommitOpBody {
  path?: unknown
  action?: unknown
  hash?: unknown
  mode?: unknown
  file?: unknown
  side?: unknown
}

type Operation = 'merge' | 'rebase' | 'cherry-pick' | 'revert'

const MAX_BODY_BYTES = 16 * 1024

function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name]
  if (value === undefined) return null
  return Array.isArray(value) ? value.join(', ') : value
}

async function readJson(req: IncomingMessage): Promise<CommitOpBody> {
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
    return parsed as CommitOpBody
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

const abortArgs: Record<Operation, string[]> = {
  merge: ['merge', '--abort'],
  rebase: ['rebase', '--abort'],
  'cherry-pick': ['cherry-pick', '--abort'],
  revert: ['revert', '--abort'],
}

const continueArgs: Record<Operation, string[]> = {
  merge: ['commit', '--no-edit'],
  rebase: ['-c', 'core.editor=true', 'rebase', '--continue'],
  'cherry-pick': ['cherry-pick', '--continue', '--no-edit'],
  revert: ['revert', '--continue', '--no-edit'],
}

const skipArgs: Partial<Record<Operation, string[]>> = {
  rebase: ['rebase', '--skip'],
  'cherry-pick': ['cherry-pick', '--skip'],
  revert: ['revert', '--skip'],
}

/**
 * POST /git-suite/commit-op: cherry-pick or revert one commit, reset the current
 * branch to a commit, or abort a stopped merge/rebase/cherry-pick/revert.
 */
export function createCommitOpsHandler(context: RouteContext): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (!admitHeaders(name => header(req, name))) {
      await send(res, json({
        ok: false,
        error: { code: 'forbidden', message: 'This request is not allowed to change the repository.' },
      }, 403))
      return
    }
    if (req.method !== 'POST') {
      await send(res, json({
        ok: false,
        error: { code: 'method-not-allowed', message: 'Commit operations require POST.' },
      }, 405))
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120_000)
    res.once('close', () => controller.abort())
    try {
      const body = await readJson(req)
      const action = typeof body.action === 'string' ? body.action : ''
      const repo = await resolveRepository(context, typeof body.path === 'string' ? body.path : '', controller.signal)

      if (action === 'abort' || action === 'continue' || action === 'skip') {
        const operation = await detectOperation(repo.root, controller.signal)
        if (operation === null) {
          throw new RouteError(409, 'nothing-in-progress', 'There is no merge, rebase, cherry-pick, or revert in progress.')
        }
        const args = action === 'abort'
          ? abortArgs[operation]
          : action === 'continue' ? continueArgs[operation] : skipArgs[operation]
        if (args === undefined) {
          throw new RouteError(400, 'skip-unsupported', 'A merge cannot be skipped; resolve it or abort.')
        }
        try {
          await runGit(repo.root, args, controller.signal)
        } catch (error) {
          const remaining = await detectOperation(repo.root, controller.signal)
          if (remaining !== null) {
            throw new RouteError(409, 'operation-conflict', 'The operation is still blocked by conflicts.', {
              operation: remaining,
              detail: error instanceof Error ? error.message : String(error),
            })
          }
          throw gitFailure(error)
        }
        let head = ''
        try {
          head = (await runGit(repo.root, ['rev-parse', 'HEAD'], controller.signal)).trim()
        } catch {
          head = ''
        }
        await send(res, json({ ok: true, action, operation, head }))
        return
      }

      if (action === 'resolve') {
        const operation = await detectOperation(repo.root, controller.signal)
        if (operation === null) {
          throw new RouteError(409, 'nothing-in-progress', 'There are no conflicts to resolve.')
        }
        const file = typeof body.file === 'string' ? body.file.trim() : ''
        const side = body.side === 'ours' || body.side === 'theirs' ? body.side : null
        if (file === '' || side === null) {
          throw new RouteError(400, 'invalid-resolve', 'Choose a file and a side to keep.', { file })
        }
        const absolute = resolve(repo.root, file)
        const inside = relative(repo.root, absolute)
        if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) {
          throw new RouteError(400, 'invalid-path', 'That file is outside the repository.', { file })
        }
        try {
          await runGit(repo.root, ['checkout', `--${side}`, '--', inside], controller.signal)
          await runGit(repo.root, ['add', '--', inside], controller.signal)
        } catch (error) {
          throw gitFailure(error)
        }
        await send(res, json({ ok: true, action, operation, file: inside, side }))
        return
      }

      if (action !== 'cherry-pick' && action !== 'revert' && action !== 'reset') {
        throw new RouteError(400, 'invalid-action', 'Unknown commit operation.')
      }
      const hash = typeof body.hash === 'string' ? body.hash.trim() : ''
      if (!/^[0-9a-f]{4,64}$/i.test(hash)) {
        throw new RouteError(400, 'invalid-commit', 'Choose a commit to operate on.')
      }
      let commit: string
      try {
        commit = (await runGit(repo.root, ['rev-parse', '--verify', `${hash}^{commit}`], controller.signal)).trim()
      } catch {
        throw new RouteError(404, 'unknown-commit', 'That commit does not exist in this repository.', { hash })
      }

      if (action === 'reset') {
        const mode = body.mode === 'soft' || body.mode === 'mixed' || body.mode === 'hard' ? body.mode : 'mixed'
        try {
          await runGit(repo.root, ['reset', `--${mode}`, commit], controller.signal)
        } catch (error) {
          throw gitFailure(error)
        }
        const head = (await runGit(repo.root, ['rev-parse', 'HEAD'], controller.signal)).trim()
        await send(res, json({ ok: true, action, mode, hash: commit, head }))
        return
      }

      const args = action === 'cherry-pick'
        ? ['cherry-pick', commit]
        : ['revert', '--no-edit', commit]
      try {
        await runGit(repo.root, args, controller.signal)
      } catch (error) {
        const operation = await detectOperation(repo.root, controller.signal)
        if (operation !== null) {
          throw new RouteError(409, 'operation-conflict', 'The operation stopped with conflicts.', {
            operation,
            detail: error instanceof Error ? error.message : String(error),
          })
        }
        throw gitFailure(error)
      }
      const head = (await runGit(repo.root, ['rev-parse', 'HEAD'], controller.signal)).trim()
      await send(res, json({ ok: true, action, hash: commit, head }))
    } catch (error) {
      await send(res, failure(error))
    } finally {
      clearTimeout(timeout)
    }
  }
}

import { access } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { RouteError } from './errors.js'
import { gitFailure, runGit } from './git.js'
import { admitHeaders, failure, json } from './http.js'
import { resolveRepository } from './repository.js'
import type { RouteContext } from './types.js'

interface CommitOpBody {
  path?: unknown
  action?: unknown
  hash?: unknown
  mode?: unknown
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

/** Which multi-step git operation currently holds the repository. */
async function detectOperation(root: string, signal: AbortSignal): Promise<Operation | null> {
  const gitDir = (await runGit(root, ['rev-parse', '--absolute-git-dir'], signal)).trim()
  const exists = async (name: string): Promise<boolean> => {
    try {
      await access(`${gitDir}/${name}`)
      return true
    } catch {
      return false
    }
  }
  if (await exists('rebase-merge')) return 'rebase'
  if (await exists('rebase-apply')) return 'rebase'
  if (await exists('MERGE_HEAD')) return 'merge'
  if (await exists('CHERRY_PICK_HEAD')) return 'cherry-pick'
  if (await exists('REVERT_HEAD')) return 'revert'
  return null
}

const abortArgs: Record<Operation, string[]> = {
  merge: ['merge', '--abort'],
  rebase: ['rebase', '--abort'],
  'cherry-pick': ['cherry-pick', '--abort'],
  revert: ['revert', '--abort'],
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

      if (action === 'abort') {
        const operation = await detectOperation(repo.root, controller.signal)
        if (operation === null) {
          throw new RouteError(409, 'nothing-in-progress', 'There is no merge, rebase, cherry-pick, or revert to abort.')
        }
        try {
          await runGit(repo.root, abortArgs[operation], controller.signal)
        } catch (error) {
          throw gitFailure(error)
        }
        await send(res, json({ ok: true, action, operation }))
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

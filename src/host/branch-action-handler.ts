import type { IncomingMessage, ServerResponse } from 'node:http'
import { RouteError } from './errors.js'
import { gitFailure, runGit } from './git.js'
import { admitHeaders, failure, json } from './http.js'
import { resolveRepository } from './repository.js'
import type { RouteContext } from './types.js'

interface BranchActionBody {
  action?: unknown
  path?: unknown
  branch?: unknown
  remote?: unknown
  newName?: unknown
}

const MAX_BODY_BYTES = 16 * 1024

function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name]
  if (value === undefined) return null
  return Array.isArray(value) ? value.join(', ') : value
}

async function readJson(req: IncomingMessage): Promise<BranchActionBody> {
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
    return parsed as BranchActionBody
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

async function checkBranch(root: string, branch: string, signal: AbortSignal): Promise<void> {
  try {
    await runGit(root, ['check-ref-format', '--branch', branch], signal)
  } catch {
    throw new RouteError(400, 'invalid-branch', 'That branch name is not valid.', { branch })
  }
}

/** POST /git-suite/branch-action: merge, rebase, rename, or delete one local branch. */
export function createBranchActionHandler(context: RouteContext): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
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
        error: { code: 'method-not-allowed', message: 'Branch actions require POST.' },
      }, 405))
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120_000)
    res.once('close', () => controller.abort())
    try {
      const body = await readJson(req)
      const action = text(body.action)
      const branch = text(body.branch)
      const remote = text(body.remote)
      if (branch === '') throw new RouteError(400, 'branch-required', 'Choose a branch.')
      if (!['merge', 'rebase', 'rename', 'delete', 'track', 'delete-remote'].includes(action)) {
        throw new RouteError(400, 'invalid-action', 'Unknown branch action.')
      }
      const repo = await resolveRepository(context, text(body.path), controller.signal)
      await checkBranch(repo.root, branch, controller.signal)

      let newName: string | undefined
      if (action === 'rename') {
        newName = text(body.newName)
        if (newName === '') throw new RouteError(400, 'name-required', 'Enter a new branch name.')
        await checkBranch(repo.root, newName, controller.signal)
        try {
          await runGit(repo.root, ['branch', '-m', branch, newName], controller.signal)
        } catch (error) {
          throw gitFailure(error).withDetails({ branch })
        }
      } else if (action === 'track') {
        // `branch` is a remote-tracking ref such as origin/main; the local name is its tail.
        newName = text(body.newName) || branch.split('/').slice(1).join('/')
        if (newName === '') throw new RouteError(400, 'name-required', 'Enter a local branch name.')
        await checkBranch(repo.root, newName, controller.signal)
        try {
          await runGit(repo.root, ['switch', '--track', '-c', newName, branch], controller.signal)
        } catch (error) {
          const detail = String((error as { stderr?: string | Buffer }).stderr ?? '')
          if (/already exists/i.test(detail)) {
            throw new RouteError(409, 'branch-exists', 'A local branch with that name already exists.', { branch: newName })
          }
          if (/local changes|would be overwritten|not possible to check out/i.test(detail)) {
            throw new RouteError(409, 'worktree-dirty', 'The working tree has changes that would be overwritten; commit or stash them first.', { detail })
          }
          throw gitFailure(error).withDetails({ branch })
        }
      } else if (action === 'delete-remote') {
        if (remote === '') throw new RouteError(400, 'remote-required', 'Choose a remote.')
        if (remote.startsWith('-') || remote.includes('\0') || /[\r\n\s]/.test(remote)) {
          throw new RouteError(400, 'invalid-remote', 'That remote name is not valid.', { remote })
        }
        const remotes = (await runGit(repo.root, ['remote'], controller.signal))
          .split(/\r?\n/)
          .map(item => item.trim())
          .filter(item => item !== '')
        if (!remotes.includes(remote)) {
          throw new RouteError(404, 'remote-not-found', 'That remote is not configured in this repository.', { remote })
        }
        try {
          await runGit(repo.root, ['push', remote, '--delete', branch], controller.signal)
        } catch (error) {
          throw gitFailure(error).withDetails({ branch, remote })
        }
      } else if (action === 'merge') {
        try {
          await runGit(repo.root, ['merge', '--no-edit', branch], controller.signal)
        } catch (error) {
          throw gitFailure(error).withDetails({ branch })
        }
      } else if (action === 'rebase') {
        try {
          await runGit(repo.root, ['rebase', branch], controller.signal)
        } catch (error) {
          throw gitFailure(error).withDetails({ branch })
        }
      } else {
        try {
          await runGit(repo.root, ['branch', '-d', branch], controller.signal)
        } catch (error) {
          throw gitFailure(error).withDetails({ branch })
        }
      }

      await send(res, json({ ok: true, action, branch, remote, ...(newName === undefined ? {} : { newName }) }))
    } catch (error) {
      await send(res, failure(error))
    } finally {
      clearTimeout(timeout)
    }
  }
}

import type { IncomingMessage, ServerResponse } from 'node:http'
import { RouteError } from './errors.js'
import { gitFailure, runGit, type GitExecError } from './git.js'
import { admitHeaders, failure, json } from './http.js'
import { isCommitHash } from './parsers.js'
import { resolveRepository } from './repository.js'
import type { RouteContext } from './types.js'

const MAX_BODY_BYTES = 64 * 1024

interface NameBody {
  path?: unknown
  hash?: unknown
  name?: unknown
  message?: unknown
  force?: unknown
  branch?: unknown
}

function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name]
  if (value === undefined) return null
  return Array.isArray(value) ? value.join(', ') : value
}

async function readJson(req: IncomingMessage): Promise<NameBody> {
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
    return parsed as NameBody
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

async function assertTagName(root: string, name: string, signal: AbortSignal): Promise<void> {
  if (name === '' || name.length > 200) throw new RouteError(400, 'invalid-tag', 'Enter a valid tag name.')
  try {
    await runGit(root, ['check-ref-format', `refs/tags/${name}`], signal)
  } catch {
    throw new RouteError(400, 'invalid-tag', 'That is not a valid tag name.')
  }
}

async function assertBranchName(root: string, name: string, signal: AbortSignal): Promise<void> {
  if (name === '' || name.length > 200) throw new RouteError(400, 'invalid-branch', 'Enter a valid branch name.')
  try {
    await runGit(root, ['check-ref-format', '--branch', name], signal)
  } catch {
    throw new RouteError(400, 'invalid-branch', 'That is not a valid branch name.')
  }
}

function checkoutFailure(error: unknown): RouteError {
  const failed = error as GitExecError
  const detail = String(failed?.stderr ?? '').trim()
  if (/local changes|would be overwritten|not possible to check out|Please commit your changes/i.test(detail)) {
    return new RouteError(409, 'worktree-dirty', 'The working tree has changes that would be overwritten; commit or stash them first.', { detail })
  }
  return gitFailure(error)
}

async function admitPost(req: IncomingMessage, res: ServerResponse, label: string): Promise<boolean> {
  if (!admitHeaders(name => header(req, name))) {
    await send(res, json({
      ok: false,
      error: { code: 'forbidden', message: `This request is not allowed to ${label}.` },
    }, 403))
    return false
  }
  if (req.method !== 'POST') {
    await send(res, json({
      ok: false,
      error: { code: 'method-not-allowed', message: `${label} requires POST.` },
    }, 405))
    return false
  }
  return true
}

/** POST /git-suite/tag: create (or force-move) a tag on one commit. */
export function createTagHandler(context: RouteContext): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (!(await admitPost(req, res, 'create a tag'))) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    res.once('close', () => controller.abort())
    try {
      const body = await readJson(req)
      const repo = await resolveRepository(context, text(body.path), controller.signal)
      const hash = text(body.hash)
      const name = text(body.name)
      const message = text(body.message)
      const force = body.force === true
      if (!isCommitHash(hash)) throw new RouteError(400, 'bad-commit', 'That commit could not be resolved.')
      await assertTagName(repo.root, name, controller.signal)
      if (message.length > 4000) throw new RouteError(400, 'message-too-long', 'The tag message is too long.')
      const args = ['tag', ...(force ? ['-f'] : []), ...(message === '' ? [] : ['-a', '-m', message]), name, hash]
      try {
        await runGit(repo.root, args, controller.signal)
      } catch (error) {
        throw gitFailure(error)
      }
      await send(res, json({ ok: true, tag: name, hash }))
    } catch (error) {
      await send(res, failure(error))
    } finally {
      clearTimeout(timeout)
    }
  }
}

/** POST /git-suite/branch: create a local branch at one commit. */
export function createBranchHandler(context: RouteContext): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (!(await admitPost(req, res, 'create a branch'))) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    res.once('close', () => controller.abort())
    try {
      const body = await readJson(req)
      const repo = await resolveRepository(context, text(body.path), controller.signal)
      const hash = text(body.hash)
      const name = text(body.name)
      if (!isCommitHash(hash)) throw new RouteError(400, 'bad-commit', 'That commit could not be resolved.')
      await assertBranchName(repo.root, name, controller.signal)
      try {
        await runGit(repo.root, ['branch', name, hash], controller.signal)
      } catch (error) {
        throw gitFailure(error)
      }
      await send(res, json({ ok: true, branch: name, hash }))
    } catch (error) {
      await send(res, failure(error))
    } finally {
      clearTimeout(timeout)
    }
  }
}

/** POST /git-suite/checkout: switch to a local branch or detach HEAD at a commit, never forced. */
export function createCheckoutHandler(context: RouteContext): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (!(await admitPost(req, res, 'check out a commit'))) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    res.once('close', () => controller.abort())
    try {
      const body = await readJson(req)
      const repo = await resolveRepository(context, text(body.path), controller.signal)
      const branch = text(body.branch)
      const hash = text(body.hash)
      if (branch === '' && hash === '') {
        throw new RouteError(400, 'no-target', 'Choose a branch or a commit to check out.')
      }
      try {
        if (branch !== '') {
          await assertBranchName(repo.root, branch, controller.signal)
          await runGit(repo.root, ['switch', branch], controller.signal)
        } else {
          if (!isCommitHash(hash)) throw new RouteError(400, 'bad-commit', 'That commit could not be resolved.')
          await runGit(repo.root, ['switch', '--detach', hash], controller.signal)
        }
      } catch (error) {
        if (error instanceof RouteError) throw error
        throw checkoutFailure(error)
      }
      const current = (await runGit(repo.root, ['branch', '--show-current'], controller.signal)).trim()
      const head = (await runGit(repo.root, ['rev-parse', 'HEAD'], controller.signal)).trim()
      await send(res, json({ ok: true, branch: current === '' ? null : current, hash: head, detached: current === '' }))
    } catch (error) {
      await send(res, failure(error))
    } finally {
      clearTimeout(timeout)
    }
  }
}

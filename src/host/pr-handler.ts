import type { IncomingMessage, ServerResponse } from 'node:http'
import { RouteError } from './errors.js'
import { detectForge, type ForgeTarget } from './forge/detect.js'
import { getPull } from './forge/index.js'
import { resolveRemote } from './forge/remote.js'
import { resolveForgeToken } from './forge/token.js'
import { gitFailure, runGit, type GitExecError } from './git.js'
import { admitHeaders, failure, json } from './http.js'
import { resolveRepository } from './repository.js'
import type { PullDetail, RouteContext } from './types.js'

interface PullBody {
  path?: unknown
  remote?: unknown
  number?: unknown
}

const MAX_BODY_BYTES = 16 * 1024
const FETCH_TIMEOUT_MS = 120_000

function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name]
  if (value === undefined) return null
  return Array.isArray(value) ? value.join(', ') : value
}

async function readJson(req: IncomingMessage): Promise<PullBody> {
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
    return parsed as PullBody
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

function numberFrom(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > 2_147_483_647) {
    throw new RouteError(400, 'invalid-number', 'Choose a valid pull request number.')
  }
  return value
}

/** The remote-tracking ref a pull request is fetched into. */
function trackingRef(remote: string, number: number): string {
  return `refs/remotes/${remote}/pr/${number}`
}

/** A remote URL git may fetch over the network (never a local path). */
function isNetworkRemote(value: string): boolean {
  if (/^(https?|ssh|git):\/\//i.test(value)) return true
  return /^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+:[^\s]+$/.test(value)
}

/** A branch name safe to place inside a refspec. */
function isSafeBranch(name: string): boolean {
  if (name === '') return false
  if (name.startsWith('-') || name.includes('..') || name.includes('@{')) return false
  return !/[\u0000-\u0020~^:?*\[\\]/.test(name)
}

/** Prefer the forge's own pull-request ref; fall back to the source branch. */
async function fetchPull(
  root: string,
  remote: string,
  number: number,
  target: ForgeTarget,
  detail: PullDetail | null,
  signal: AbortSignal,
): Promise<{ localRef: string; fetchedFrom: string }> {
  const destination = trackingRef(remote, number)
  const attempts: Array<{ url: string; ref: string }> = []
  const pullRef = target.provider === 'gitlab' ? `refs/merge-requests/${number}/head` : `refs/pull/${number}/head`
  attempts.push({ url: remote, ref: pullRef })

  const sourceBranch = detail?.sourceBranch ?? ''
  if (detail !== null && isSafeBranch(sourceBranch)) {
    attempts.push({ url: remote, ref: `refs/heads/${sourceBranch}` })
  }
  if (detail !== null && isSafeBranch(sourceBranch) && detail.headRepoUrl !== null && isNetworkRemote(detail.headRepoUrl)) {
    attempts.push({ url: detail.headRepoUrl, ref: `refs/heads/${sourceBranch}` })
  }

  let lastError: unknown = null
  for (const attempt of attempts) {
    try {
      await runGit(root, ['fetch', '--no-tags', attempt.url, `+${attempt.ref}:${destination}`], signal, FETCH_TIMEOUT_MS)
      return { localRef: destination, fetchedFrom: attempt.url === remote ? remote : attempt.url }
    } catch (error) {
      lastError = error
    }
  }
  throw gitFailure(lastError).withDetails({ remote, number })
}

/** Map a refused switch onto the route's worktree-dirty vocabulary. */
function switchFailure(error: unknown, branch: string): RouteError {
  const failed = (error ?? {}) as GitExecError
  const detail = String(failed.stderr ?? '').trim().slice(0, 1200)
  if (/would be overwritten|Please commit your changes|local changes/i.test(detail)) {
    return new RouteError(409, 'worktree-dirty', 'The working tree has changes this checkout would overwrite.', {
      branch,
      detail,
    })
  }
  return gitFailure(error).withDetails({ branch })
}

/**
 * POST /git-suite/pr: check out one pull request locally. The forge's PR ref is
 * fetched into a remote-tracking ref, then a local `pr/<number>` branch is
 * created (or reused) and switched to. Nothing is pushed.
 */
export function createPullHandler(context: RouteContext): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (!admitHeaders(name => header(req, name))) {
      await send(res, json({
        ok: false,
        error: { code: 'forbidden', message: 'This request is not allowed to change the working tree.' },
      }, 403))
      return
    }
    if (req.method !== 'POST') {
      await send(res, json({
        ok: false,
        error: { code: 'method-not-allowed', message: 'Checking out a pull request requires POST.' },
      }, 405))
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 300_000)
    res.once('close', () => controller.abort())
    const signal = controller.signal
    try {
      const body = await readJson(req)
      const number = numberFrom(body.number)
      const repo = await resolveRepository(context, typeof body.path === 'string' ? body.path : '', signal)
      const remote = await resolveRemote(repo.root, typeof body.remote === 'string' ? body.remote : '', signal)
      const target = detectForge(remote.url)
      if (target === null) {
        throw new RouteError(400, 'forge-unsupported', 'This remote is not hosted on a supported forge.', { remote: remote.name })
      }

      // Metadata drives the source-branch fallback; a failure here is not fatal
      // when the forge's pull-request ref can still be fetched.
      let detail: PullDetail | null = null
      try {
        const token = await resolveForgeToken(repo.root, target, signal)
        detail = await getPull(target, number, token, signal)
      } catch {
        detail = null
      }

      const fetched = await fetchPull(repo.root, remote.name, number, target, detail, signal)
      const branch = `pr/${number}`

      let existing = false
      try {
        await runGit(repo.root, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], signal)
        existing = true
      } catch {
        existing = false
      }

      try {
        if (existing) {
          await runGit(repo.root, ['switch', branch], signal)
        } else {
          await runGit(repo.root, ['switch', '-c', branch, fetched.localRef], signal)
        }
      } catch (error) {
        throw switchFailure(error, branch)
      }

      const hash = (await runGit(repo.root, ['rev-parse', 'HEAD'], signal)).trim()
      await send(res, json({ ok: true, branch, hash, existing }))
    } catch (error) {
      await send(res, failure(error))
    } finally {
      clearTimeout(timeout)
    }
  }
}

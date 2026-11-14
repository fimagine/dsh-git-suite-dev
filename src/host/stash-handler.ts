import type { IncomingMessage, ServerResponse } from 'node:http'
import { RouteError } from './errors.js'
import { gitFailure, runGit } from './git.js'
import { admitHeaders, failure, json } from './http.js'
import { resolveRepository } from './repository.js'
import type { RouteContext } from './types.js'

interface StashBody {
  path?: unknown
  action?: unknown
  ref?: unknown
  message?: unknown
  includeUntracked?: unknown
}

const MAX_BODY_BYTES = 16 * 1024
const STASH_REF = /^stash@\{\d{1,3}\}$/

function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name]
  if (value === undefined) return null
  return Array.isArray(value) ? value.join(', ') : value
}

async function readJson(req: IncomingMessage): Promise<StashBody> {
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
    return parsed as StashBody
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

function stashRef(value: unknown): string {
  const ref = typeof value === 'string' ? value.trim() : ''
  if (!STASH_REF.test(ref)) {
    throw new RouteError(400, 'invalid-stash', 'That stash reference is not valid.', { ref })
  }
  return ref
}

/** POST /git-suite/stash: push, apply, pop, or drop one stash entry. */
export function createStashHandler(context: RouteContext): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
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
        error: { code: 'method-not-allowed', message: 'Stash operations require POST.' },
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

      if (action === 'save') {
        const message = typeof body.message === 'string' ? body.message.trim() : ''
        const args = ['stash', 'push']
        if (body.includeUntracked === true) args.push('--include-untracked')
        if (message !== '') args.push('-m', message)
        let output = ''
        try {
          output = await runGit(repo.root, args, controller.signal)
        } catch (error) {
          throw gitFailure(error)
        }
        if (/no local changes to save/i.test(output)) {
          throw new RouteError(409, 'nothing-to-stash', 'There are no local changes to stash.')
        }
        const ref = (await runGit(repo.root, ['rev-parse', '--verify', '--short', 'stash@{0}'], controller.signal)).trim()
        await send(res, json({ ok: true, action, ref: 'stash@{0}', hash: ref }))
        return
      }

      if (action !== 'apply' && action !== 'pop' && action !== 'drop') {
        throw new RouteError(400, 'invalid-action', 'Unknown stash action.')
      }
      const ref = stashRef(body.ref)
      try {
        await runGit(repo.root, ['stash', action, ref], controller.signal)
      } catch (error) {
        throw gitFailure(error)
      }
      await send(res, json({ ok: true, action, ref }))
    } catch (error) {
      await send(res, failure(error))
    } finally {
      clearTimeout(timeout)
    }
  }
}

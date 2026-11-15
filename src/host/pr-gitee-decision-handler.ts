import type { IncomingMessage, ServerResponse } from 'node:http'
import { RouteError } from './errors.js'
import { detectForge } from './forge/detect.js'
import { decideGiteePull } from './forge/index.js'
import { resolveRemote } from './forge/remote.js'
import { resolveForgeToken } from './forge/token.js'
import { admitHeaders, failure, json } from './http.js'
import { resolveRepository } from './repository.js'
import type { RouteContext } from './types.js'

interface DecisionBody {
  path?: unknown
  remote?: unknown
  number?: unknown
  action?: unknown
}

function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name]
  if (value === undefined) return null
  return Array.isArray(value) ? value.join(', ') : value
}

async function readJson(req: IncomingMessage): Promise<DecisionBody> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 16 * 1024) throw new RouteError(413, 'body-too-large', 'The request body is too large.')
    chunks.push(buffer)
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object')
    return parsed as DecisionBody
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

/** POST /git-suite/pr-gitee-decision: mark review or test as passed on Gitee. */
export function createGiteeDecisionHandler(context: RouteContext): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (!admitHeaders(name => header(req, name))) {
      await send(res, json({
        ok: false,
        error: { code: 'forbidden', message: 'This request is not allowed to update a pull request.' },
      }, 403))
      return
    }
    if (req.method !== 'POST') {
      await send(res, json({
        ok: false,
        error: { code: 'method-not-allowed', message: 'Updating a pull request requires POST.' },
      }, 405))
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    res.once('close', () => controller.abort())
    const signal = controller.signal
    try {
      const body = await readJson(req)
      const action = body.action === 'review' || body.action === 'test' ? body.action : null
      if (action === null) throw new RouteError(400, 'invalid-action', 'Choose the review or test action.')
      const number = typeof body.number === 'number' ? body.number : Number.NaN
      if (!Number.isInteger(number) || number <= 0 || number > 2_147_483_647) {
        throw new RouteError(400, 'invalid-number', 'That pull request number is not valid.')
      }

      const repo = await resolveRepository(context, typeof body.path === 'string' ? body.path : '', signal)
      const remote = await resolveRemote(repo.root, typeof body.remote === 'string' ? body.remote : '', signal)
      const target = detectForge(remote.url)
      if (target === null) {
        throw new RouteError(400, 'forge-unsupported', 'This remote is not hosted on a supported forge.', { remote: remote.name })
      }
      if (target.provider !== 'gitee') {
        throw new RouteError(400, 'forge-unsupported', 'Review and test approvals are only available on Gitee.', { remote: remote.name })
      }

      const token = await resolveForgeToken(repo.root, target, signal)
      if (token === null) {
        throw new RouteError(401, 'forge-auth-required', 'The forge requires an access token.', {
          remote: remote.name,
          provider: target.provider,
          host: target.host,
        })
      }

      try {
        await decideGiteePull(target, number, token, action, signal)
      } catch (error) {
        if (error instanceof RouteError) throw error.withDetails({ remote: remote.name })
        throw error
      }
      await send(res, json({ ok: true, action, number }))
    } catch (error) {
      await send(res, failure(error))
    } finally {
      clearTimeout(timeout)
    }
  }
}

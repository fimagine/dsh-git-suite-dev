import type { IncomingMessage, ServerResponse } from 'node:http'
import { RouteError } from './errors.js'
import { detectForge, type ForgeTarget } from './forge/detect.js'
import { resolveRemote } from './forge/remote.js'
import { resolveForgeToken } from './forge/token.js'
import { admitHeaders, failure, json, readJsonBody, sendResponse } from './http.js'
import { resolveRepository } from './repository.js'
import type { ForgeProvider, RouteContext } from './types.js'

export interface ForgePostEnv {
  repoRoot: string
  remote: string
  target: ForgeTarget
  token: string
  signal: AbortSignal
}

/** Gitee/GitLab request numbers are signed 32-bit integers. */
const MAX_PULL_NUMBER = 2_147_483_647

/** Validate the shared `number` field used by pull-request write routes. */
export function parsePullNumber(value: unknown): number {
  const number = typeof value === 'number' ? value : Number.NaN
  if (!Number.isInteger(number) || number <= 0 || number > MAX_PULL_NUMBER) {
    throw new RouteError(400, 'invalid-number', 'That pull request number is not valid.')
  }
  return number
}

export interface ForgePostBody {
  path?: unknown
  remote?: unknown
}

export interface ForgePostOptions<T extends ForgePostBody> {
  forbidden: string
  methodMessage: string
  maxBytes?: number
  timeoutMs?: number
  /** Reject other forges before resolving a token. */
  provider?: ForgeProvider
  providerMessage?: string
  handle(body: T, env: ForgePostEnv): Promise<Record<string, unknown>>
}

function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name]
  if (value === undefined) return null
  return Array.isArray(value) ? value.join(', ') : value
}

/**
 * Shared POST plumbing for forge write routes: same-origin admission, body
 * limits, repository/remote/forge/token resolution, timeout, and response.
 */
export async function withForgePost<T extends ForgePostBody>(
  req: IncomingMessage,
  res: ServerResponse,
  context: RouteContext,
  options: ForgePostOptions<T>,
): Promise<void> {
  if (!admitHeaders(name => header(req, name))) {
    await sendResponse(res, json({
      ok: false,
      error: { code: 'forbidden', message: options.forbidden },
    }, 403))
    return
  }
  if (req.method !== 'POST') {
    await sendResponse(res, json({
      ok: false,
      error: { code: 'method-not-allowed', message: options.methodMessage },
    }, 405))
    return
  }

  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, options.timeoutMs ?? 30_000)
  const onClose = (): void => controller.abort()
  res.once('close', onClose)
  const signal = controller.signal
  let remoteName: string | null = null
  try {
    const body = await readJsonBody<T>(req, options.maxBytes ?? 64 * 1024)
    const repo = await resolveRepository(context, typeof body.path === 'string' ? body.path : '', signal)
    const remote = await resolveRemote(repo.root, typeof body.remote === 'string' ? body.remote : '', signal)
    remoteName = remote.name
    const target = detectForge(remote.url)
    if (target === null) {
      throw new RouteError(400, 'forge-unsupported', 'This remote is not hosted on a supported forge.', { remote: remote.name })
    }
    if (options.provider !== undefined && target.provider !== options.provider) {
      throw new RouteError(
        400,
        'forge-unsupported',
        options.providerMessage ?? `This action is only available on ${options.provider}.`,
        { remote: remote.name, provider: target.provider },
      )
    }
    const token = await resolveForgeToken(repo.root, target, signal)
    if (token === null) {
      throw new RouteError(401, 'forge-auth-required', 'The forge requires an access token.', {
        remote: remote.name,
        provider: target.provider,
        host: target.host,
      })
    }
    const payload = await options.handle(body, { repoRoot: repo.root, remote: remote.name, target, token, signal })
    await sendResponse(res, json({ ok: true, ...payload }))
  } catch (error) {
    const annotated = error instanceof RouteError && remoteName !== null && error.details?.remote === undefined
      ? error.withDetails({ remote: remoteName })
      : error
    if (signal.aborted) {
      // A normal response close may abort the controller after the handler has
      // already returned. A timeout gets a 504; if the response is still open,
      // keep the original error instead of swallowing it.
      if (timedOut) {
        await sendResponse(res, failure(new RouteError(504, 'forge-timeout', 'The forge request timed out.')))
      } else if (!res.writableEnded && !res.destroyed) {
        await sendResponse(res, failure(annotated))
      }
      return
    }
    await sendResponse(res, failure(annotated))
  } finally {
    clearTimeout(timeout)
    res.off('close', onClose)
  }
}

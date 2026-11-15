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

export interface ForgePostOptions<T extends object> {
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
export async function withForgePost<T extends object>(
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
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000)
  res.once('close', () => controller.abort())
  const signal = controller.signal
  let remoteName: string | null = null
  try {
    const body = await readJsonBody<T>(req, options.maxBytes ?? 64 * 1024)
    const paths = body as { path?: unknown; remote?: unknown }
    const repo = await resolveRepository(context, typeof paths.path === 'string' ? paths.path : '', signal)
    const remote = await resolveRemote(repo.root, typeof paths.remote === 'string' ? paths.remote : '', signal)
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
    await sendResponse(res, failure(annotated))
  } finally {
    clearTimeout(timeout)
  }
}

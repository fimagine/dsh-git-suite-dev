import { RouteError } from '../errors.js'
import type { ForgeProvider } from '../types.js'
import type { ForgeTarget } from './detect.js'

const TIMEOUT_MS = 15_000
const MAX_RESPONSE_CHARS = 2 * 1024 * 1024
const CACHE_TTL_MS = 60_000
const CACHE_LIMIT = 64

interface CacheEntry {
  expires: number
  value: unknown
}

const cache = new Map<string, CacheEntry>()

/** Drop cached forge responses (used by tests and after a manual refresh). */
export function resetForgeCache(): void {
  cache.clear()
}

function cacheGet(key: string): unknown {
  const entry = cache.get(key)
  if (entry === undefined) return undefined
  if (entry.expires <= Date.now()) {
    cache.delete(key)
    return undefined
  }
  return entry.value
}

function cacheSet(key: string, value: unknown): void {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value })
}

/** Remove the token from any text that may reach the UI, and keep it short. */
function sanitize(value: string, token: string | null): string {
  let text = value.replace(/\s+/g, ' ').trim()
  if (token !== null && token !== '') text = text.split(token).join('***')
  return text.slice(0, 300)
}

/** Read the forge's own error message from a JSON error body. */
function errorMessage(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body)
    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as Record<string, unknown>
      for (const key of ['message', 'error_description', 'error']) {
        const value = record[key]
        if (typeof value === 'string' && value.trim() !== '') return value
      }
    }
  } catch {
    // Not JSON: fall through to the raw text.
  }
  return body
}

function rateLimitReset(headers: Headers): string | null {
  const raw = headers.get('x-ratelimit-reset') ?? headers.get('ratelimit-reset')
  if (raw === null) return null
  const seconds = Number.parseInt(raw, 10)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return new Date(seconds * 1000).toISOString()
}

function authHeaders(target: ForgeTarget, token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'user-agent': 'dsh-git-suite',
  }
  if (token === null || token === '') return headers
  if (target.provider === 'github') {
    headers.authorization = `Bearer ${token}`
    headers['x-github-api-version'] = '2022-11-28'
  } else if (target.provider === 'gitlab') {
    headers['private-token'] = token
  }
  // Gitee accepts the token as a query parameter; it is added in forgeJson.
  return headers
}

function providerDetails(target: ForgeTarget): { provider: ForgeProvider; host: string } {
  return { provider: target.provider, host: target.host }
}

/**
 * Call one forge API endpoint and parse its JSON body. Token handling, timeouts,
 * response limits, rate limits, error codes, and a short GET cache all live here
 * so the provider adapters only map payloads.
 */
export async function forgeJson<T>(
  target: ForgeTarget,
  path: string,
  token: string | null,
  signal?: AbortSignal,
  options?: {
    fresh?: boolean
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    body?: unknown
  },
): Promise<T> {
  const method = options?.method ?? 'GET'
  const url = new URL(`${target.apiBase}${path}`)
  if (target.provider === 'gitee' && token !== null && token !== '') {
    url.searchParams.set('access_token', token)
  }
  // The cache key never contains the token.
  const key = `${target.provider} ${url.origin} ${url.pathname}${url.search.replace(/[?&]access_token=[^&]*/g, '')}`
  const canCache = method === 'GET' && options?.fresh !== true
  const cached = canCache ? cacheGet(key) : undefined
  if (cached !== undefined) return cached as T

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const forwardAbort = (): void => controller.abort()
  if (signal !== undefined) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', forwardAbort, { once: true })
  }

  let response: Response
  try {
    const headers = authHeaders(target, token)
    if (options?.body !== undefined) headers['content-type'] = 'application/json'
    response = await fetch(url, {
      method,
      headers,
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      redirect: 'follow',
    })
  } catch (error) {
    if (signal?.aborted === true) {
      throw new RouteError(499, 'cancelled', 'The request was cancelled.', providerDetails(target))
    }
    if (controller.signal.aborted) {
      throw new RouteError(504, 'forge-timeout', 'The forge did not answer in time.', providerDetails(target))
    }
    throw new RouteError(502, 'forge-unreachable', 'Could not reach the forge.', {
      ...providerDetails(target),
      detail: sanitize(error instanceof Error ? error.message : String(error), token),
    })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }

  let body = ''
  try {
    const declared = Number.parseInt(response.headers.get('content-length') ?? '', 10)
    if (Number.isFinite(declared) && declared > MAX_RESPONSE_CHARS) {
      throw new RouteError(502, 'forge-response-too-large', 'The forge response was too large.', providerDetails(target))
    }
    body = await response.text()
  } catch (error) {
    if (error instanceof RouteError) throw error
    if (signal?.aborted === true) {
      throw new RouteError(499, 'cancelled', 'The request was cancelled.', providerDetails(target))
    }
    throw new RouteError(502, 'forge-unreachable', 'The forge response could not be read.', providerDetails(target))
  }
  if (body.length > MAX_RESPONSE_CHARS) {
    throw new RouteError(502, 'forge-response-too-large', 'The forge response was too large.', providerDetails(target))
  }

  if (!response.ok) {
    const detail = sanitize(errorMessage(body), token)
    if (response.status === 401) {
      throw new RouteError(401, 'forge-auth-required', 'The forge requires an access token.', {
        ...providerDetails(target),
        detail,
      })
    }
    if (response.status === 403) {
      const resetAt = rateLimitReset(response.headers)
      if (resetAt !== null || response.headers.get('x-ratelimit-remaining') === '0') {
        throw new RouteError(429, 'forge-rate-limited', 'The forge rate limit was reached.', {
          ...providerDetails(target),
          resetAt,
        })
      }
      throw new RouteError(403, 'forge-forbidden', 'The forge refused this request.', {
        ...providerDetails(target),
        detail,
      })
    }
    if (response.status === 404) {
      throw new RouteError(404, 'forge-not-found', 'The forge has no such repository or request.', {
        ...providerDetails(target),
        detail,
      })
    }
    if (response.status === 429) {
      throw new RouteError(429, 'forge-rate-limited', 'The forge rate limit was reached.', {
        ...providerDetails(target),
        resetAt: rateLimitReset(response.headers),
      })
    }
    throw new RouteError(502, 'forge-request-failed', `The forge answered with HTTP ${response.status}.`, {
      ...providerDetails(target),
      detail,
    })
  }

  // A successful mutation may answer 204/empty; only GET must be JSON.
  if (body.trim() === '' && method !== 'GET') return undefined as T

  try {
    const parsed = JSON.parse(body) as T
    if (canCache) cacheSet(key, parsed)
    return parsed
  } catch {
    throw new RouteError(502, 'forge-invalid-response', 'The forge sent a response this viewer cannot read.', providerDetails(target))
  }
}

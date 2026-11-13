export interface ErrorDetails {
  path?: string
  detail?: string
  ref?: string
  hash?: string
  [key: string]: unknown
}

/** A route failure with the host's stable error code and diagnostics. */
export class ApiError extends Error {
  readonly code: string
  readonly details?: ErrorDetails

  constructor(message: string, code: string, details?: ErrorDetails) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }
}

export type RequestMode = 'projects' | 'branches' | 'log' | 'commit'

export interface RequestParams {
  mode: RequestMode
  path?: string | null
  limit?: string
  offset?: string
  scope?: 'all' | 'remotes'
  ref?: string
  hash?: string
}

interface ErrorPayload {
  ok?: boolean
  error?: { code?: string; message?: string; details?: ErrorDetails }
}

/** Fetch one JSON payload from the plugin's read-only route. */
export async function requestJson<T>(params: RequestParams, signal?: AbortSignal): Promise<T> {
  const url = new URL('/git-log', window.location.origin)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  }
  const response = await fetch(url, {
    method: 'GET',
    signal,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'x-dsh-git-log': '1' },
  })
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  const parsed = payload as ErrorPayload | null
  if (response.ok && parsed?.ok === true) return payload as T
  throw new ApiError(
    parsed?.error?.message ?? `Request failed with HTTP ${response.status}`,
    parsed?.error?.code ?? 'request-failed',
    parsed?.error?.details,
  )
}

export function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'
}

export function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : String(error), 'internal')
}

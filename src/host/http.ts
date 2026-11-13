import { RouteError } from './errors.js'

/** Serialize a successful or failed payload as a non-cacheable JSON response. */
export function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  })
}

/** Turn any thrown value into the route's JSON failure shape. */
export function failure(error: unknown): Response {
  const routeError = error instanceof RouteError ? error : null
  const status = routeError?.status ?? 500
  const code = routeError?.code ?? 'internal'
  const message = error instanceof Error ? error.message : String(error)
  return json({
    ok: false,
    error: {
      code,
      message: message.slice(0, 2000),
      ...(routeError?.details === undefined ? {} : { details: routeError.details }),
    },
  }, status)
}

/**
 * Accept only same-origin page requests that carry the plugin's private header,
 * so a cross-site page cannot read repository paths and diffs through the route.
 */
export function admit(request: Request): boolean {
  if (request.headers.get('x-dsh-git-log') !== '1') return false

  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (origin !== null && host !== null) {
    try {
      if (new URL(origin).host !== host) return false
    } catch {
      return false
    }
  }

  const site = request.headers.get('sec-fetch-site')
  if (site !== null && site !== 'same-origin' && site !== 'none') return false
  return true
}

import type { IncomingMessage, ServerResponse } from 'node:http'
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

/** Read one bounded JSON object body from a POST handler. */
export async function readJsonBody<T extends object>(req: IncomingMessage, maxBytes = 64 * 1024): Promise<T> {
  const declared = req.headers['content-length']
  const declaredLength = Array.isArray(declared) ? Number(declared[0]) : Number(declared)
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    req.resume()
    throw new RouteError(413, 'body-too-large', 'The request body is too large.')
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxBytes) {
      req.resume()
      throw new RouteError(413, 'body-too-large', 'The request body is too large.')
    }
    chunks.push(buffer)
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object')
    return parsed as T
  } catch {
    throw new RouteError(400, 'invalid-body', 'The request body must be a JSON object.')
  }
}

/** Write a fetched Response back through the Node response. */
export async function sendResponse(res: ServerResponse, response: Response): Promise<void> {
  if (res.writableEnded || res.destroyed) return
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })
  res.end(Buffer.from(await response.arrayBuffer()))
}

/**
 * Accept only same-origin page requests that carry the plugin's private header,
 * so a cross-site page cannot read repository paths and diffs through the route.
 * The reader returns lowercase header names.
 */
export function admitHeaders(read: (name: string) => string | null): boolean {
  if (read('x-dsh-git-suite') !== '1') return false

  const origin = read('origin')
  const host = read('host')
  if (origin !== null && host !== null) {
    try {
      if (new URL(origin).host !== host) return false
    } catch {
      return false
    }
  }

  const site = read('sec-fetch-site')
  if (site !== null && site !== 'same-origin' && site !== 'none') return false
  return true
}

export function admit(request: Request): boolean {
  return admitHeaders(name => request.headers.get(name))
}

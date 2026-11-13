import type { IncomingMessage, ServerResponse } from 'node:http'
import { admitHeaders, failure, json } from './http.js'
import { switchBranch } from './routes/switch.js'
import type { RouteContext } from './types.js'

export type SwitchHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>

/** Read one lowercase Node request header as a string. */
function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name]
  if (value === undefined) return null
  return Array.isArray(value) ? value.join(', ') : value
}

/** Write a Fetch response onto the Node response owned by a handler route. */
async function send(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })
  res.end(Buffer.from(await response.arrayBuffer()))
}

/**
 * POST /git-suite/switch. DSH's resource routes only accept GET/HEAD and answer
 * 405 for anything else, so the branch mutation needs a real Node handler.
 */
export function createSwitchHandler(context: RouteContext): SwitchHandler {
  return async (req, res) => {
    if (!admitHeaders(name => header(req, name))) {
      await send(res, json({
        ok: false,
        error: { code: 'forbidden', message: 'This request is not allowed to switch branches.' },
      }, 403))
      return
    }
    if (req.method !== 'POST') {
      await send(res, json({
        ok: false,
        error: { code: 'method-not-allowed', message: 'Switching branches requires POST.' },
      }, 405))
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    res.once('close', () => controller.abort())
    try {
      const url = new URL(req.url ?? '/', 'http://dsh.local')
      await send(res, json(await switchBranch(context, url, controller.signal)))
    } catch (error) {
      await send(res, failure(error))
    } finally {
      clearTimeout(timeout)
    }
  }
}

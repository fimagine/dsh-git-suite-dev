import { spawn } from 'node:child_process'
import { stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { RouteError } from './errors.js'
import { admitHeaders, failure, json } from './http.js'
import { resolveRepository } from './repository.js'
import type { RouteContext } from './types.js'

interface RevealBody {
  path?: unknown
  file?: unknown
}

const MAX_BODY_BYTES = 16 * 1024

function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name]
  if (value === undefined) return null
  return Array.isArray(value) ? value.join(', ') : value
}

async function readJson(req: IncomingMessage): Promise<RevealBody> {
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
    return parsed as RevealBody
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

/** Ask the OS file browser to show `target`; a failure to open is not an error here. */
function reveal(target: string): void {
  const options = { detached: true, stdio: 'ignore' as const, windowsHide: false }
  let command: string
  let args: string[]
  if (process.platform === 'win32') {
    command = 'explorer.exe'
    args = [`/select,${target}`]
  } else if (process.platform === 'darwin') {
    command = 'open'
    args = ['-R', target]
  } else {
    command = 'xdg-open'
    args = [dirname(target)]
  }
  try {
    const child = spawn(command, args, options)
    child.on('error', () => {})
    child.unref()
  } catch {
    // The desktop may refuse to open a window; the file still exists.
  }
}

/** POST /git-suite/reveal: show one working-tree file in the OS file browser. */
export function createRevealHandler(context: RouteContext): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (!admitHeaders(name => header(req, name))) {
      await send(res, json({
        ok: false,
        error: { code: 'forbidden', message: 'This request is not allowed to open a file.' },
      }, 403))
      return
    }
    if (req.method !== 'POST') {
      await send(res, json({
        ok: false,
        error: { code: 'method-not-allowed', message: 'Opening a file requires POST.' },
      }, 405))
      return
    }

    try {
      const body = await readJson(req)
      const file = typeof body.file === 'string' ? body.file.trim() : ''
      if (file === '' || file.includes('\0') || /[\r\n]/.test(file)) {
        throw new RouteError(400, 'file-required', 'Choose a file to reveal.')
      }
      const repo = await resolveRepository(context, typeof body.path === 'string' ? body.path : '')
      const target = isAbsolute(file) ? resolve(file) : resolve(repo.root, file)
      const inside = relative(repo.root, target)
      if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) {
        throw new RouteError(400, 'invalid-path', 'That file is outside the repository.', { path: target })
      }
      try {
        await stat(target)
      } catch {
        throw new RouteError(404, 'file-missing', 'That file does not exist on disk.', { file: inside })
      }
      reveal(target)
      await send(res, json({ ok: true, file: inside, path: target }))
    } catch (error) {
      await send(res, failure(error))
    }
  }
}

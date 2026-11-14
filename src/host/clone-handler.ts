import { randomUUID } from 'node:crypto'
import { rename, rm, stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { basename, dirname, isAbsolute, resolve } from 'node:path'
import { RouteError } from './errors.js'
import { gitFailure, runGit } from './git.js'
import { admitHeaders, failure, json } from './http.js'

const MAX_BODY_BYTES = 64 * 1024

/** A network clone can take far longer than the timeout used for read-only git commands. */
const CLONE_TIMEOUT_MS = 30 * 60_000

interface CloneBody {
  url?: unknown
  path?: unknown
}

function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name]
  if (value === undefined) return null
  return Array.isArray(value) ? value.join(', ') : value
}

async function readJson(req: IncomingMessage): Promise<CloneBody> {
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
    return parsed as CloneBody
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

/** Refuse ext::/fd:: style transports that execute local commands. */
function isSupportedRemote(value: string): boolean {
  if (value === '' || value.length > 2048) return false
  if (/^[a-z][a-z0-9+.-]*::/i.test(value)) return false
  if (/^(https?|ssh|git|file):\/\//i.test(value)) return true
  if (/^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+:[^\s]+$/.test(value)) return true
  return isAbsolute(value)
}

/** POST /git-suite/clone: clone a remote repository into a new local directory. */
export function createCloneHandler(): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (!admitHeaders(name => header(req, name))) {
      await send(res, json({
        ok: false,
        error: { code: 'forbidden', message: 'This request is not allowed to clone repositories.' },
      }, 403))
      return
    }
    if (req.method !== 'POST') {
      await send(res, json({
        ok: false,
        error: { code: 'method-not-allowed', message: 'Cloning requires POST.' },
      }, 405))
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CLONE_TIMEOUT_MS)
    res.once('close', () => controller.abort())
    try {
      const body = await readJson(req)
      const url = typeof body.url === 'string' ? body.url.trim() : ''
      const rawPath = typeof body.path === 'string' ? body.path.trim() : ''
      if (!isSupportedRemote(url)) {
        throw new RouteError(400, 'invalid-url', 'Enter a supported Git remote URL (https, ssh, git, file, or a local path).')
      }
      if (rawPath === '' || rawPath.includes('\0') || !isAbsolute(rawPath)) {
        throw new RouteError(400, 'invalid-path', 'Enter an absolute local directory for the clone.')
      }
      const destination = resolve(rawPath)
      const parent = dirname(destination)
      let parentInfo
      try {
        parentInfo = await stat(parent)
      } catch {
        throw new RouteError(400, 'parent-missing', 'The parent directory does not exist.', { path: parent })
      }
      if (!parentInfo.isDirectory()) {
        throw new RouteError(400, 'parent-not-directory', 'The parent path is not a directory.', { path: parent })
      }
      try {
        await stat(destination)
        throw new RouteError(409, 'destination-exists', 'The destination already exists; choose another directory.', { path: destination })
      } catch (error) {
        if (error instanceof RouteError) throw error
        // ENOENT is the expected case: git clone creates the destination.
      }

      // Clone beside the destination and rename on success: a clone that is
      // cancelled or fails never leaves a destination that blocks a retry.
      const staging = resolve(parent, `${basename(destination)}.cloning-${randomUUID().slice(0, 8)}`)
      try {
        await runGit(parent, ['clone', '--', url, staging], controller.signal, CLONE_TIMEOUT_MS)
        try {
          await rename(staging, destination)
        } catch {
          throw new RouteError(409, 'destination-exists', 'The destination already exists; choose another directory.', { path: destination })
        }
      } catch (error) {
        await rm(staging, { recursive: true, force: true }).catch(() => {})
        throw error instanceof RouteError ? error : gitFailure(error)
      }
      await send(res, json({ ok: true, repoRoot: destination }))
    } catch (error) {
      await send(res, failure(error))
    } finally {
      clearTimeout(timeout)
    }
  }
}

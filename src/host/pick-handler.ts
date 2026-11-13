import type { IncomingMessage, ServerResponse } from 'node:http'
import { basename, resolve } from 'node:path'
import type { DirectoryPickerService, WorkspaceRegistryEntry } from './dsh.js'
import { RouteError } from './errors.js'
import { admitHeaders, failure, json } from './http.js'
import { resolveRepository } from './repository.js'
import type { RouteContext } from './types.js'

const MAX_BODY_BYTES = 64 * 1024

interface PickBody {
  mode?: unknown
}

function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name]
  if (value === undefined) return null
  return Array.isArray(value) ? value.join(', ') : value
}

async function readJson(req: IncomingMessage): Promise<PickBody> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new RouteError(413, 'body-too-large', 'The request body is too large.')
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (text === '') return {}
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object')
    return parsed as PickBody
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

function samePath(left: string, right: string): boolean {
  const a = resolve(left)
  const b = resolve(right)
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}

/**
 * POST /git-suite/pick-directory: open the host's native directory chooser.
 * `mode: 'repo'` (default) resolves a Git root and reports DSH workspace status;
 * `mode: 'directory'` returns a plain directory for the clone destination.
 */
export function createPickDirectoryHandler(
  context: RouteContext,
  picker: DirectoryPickerService,
  listWorkspaces: () => WorkspaceRegistryEntry[],
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (!admitHeaders(name => header(req, name))) {
      await send(res, json({
        ok: false,
        error: { code: 'forbidden', message: 'This request is not allowed to pick a directory.' },
      }, 403))
      return
    }
    if (req.method !== 'POST') {
      await send(res, json({
        ok: false,
        error: { code: 'method-not-allowed', message: 'Picking a directory requires POST.' },
      }, 405))
      return
    }

    const controller = new AbortController()
    // The native chooser waits for the person at the host display.
    const timeout = setTimeout(() => controller.abort(), 300_000)
    res.once('close', () => controller.abort())
    try {
      const body = await readJson(req)
      const mode = body.mode === 'directory' ? 'directory' : 'repo'
      const capability = picker.capability()
      if (capability.kind !== 'native') {
        await send(res, json({ ok: true, capability: 'browse' }))
        return
      }
      const picked = await capability.pick(controller.signal)
      if (picked === null) {
        await send(res, json({ ok: true, capability: 'native', cancelled: true }))
        return
      }
      if (mode === 'directory') {
        await send(res, json({ ok: true, capability: 'native', path: picked }))
        return
      }
      const repo = await resolveRepository(context, picked, controller.signal)
      const workspace = listWorkspaces().find(entry => samePath(entry.path, repo.root))
      await send(res, json({
        ok: true,
        capability: 'native',
        path: repo.root,
        name: basename(repo.root),
        hasWorkspace: workspace !== undefined,
        ...(workspace === undefined ? {} : { workspaceTitle: workspace.title }),
      }))
    } catch (error) {
      await send(res, failure(error))
    } finally {
      clearTimeout(timeout)
    }
  }
}

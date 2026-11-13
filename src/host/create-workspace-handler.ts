import type { IncomingMessage, ServerResponse } from 'node:http'
import { basename } from 'node:path'
import type { WorkspaceRegistry } from './dsh.js'
import { RouteError } from './errors.js'
import { admitHeaders, failure, json } from './http.js'
import { resolveRepository } from './repository.js'
import type { RouteContext } from './types.js'

interface CreateWorkspaceBody {
  path?: unknown
}

const MAX_BODY_BYTES = 64 * 1024

function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name]
  if (value === undefined) return null
  return Array.isArray(value) ? value.join(', ') : value
}

async function readJson(req: IncomingMessage): Promise<CreateWorkspaceBody> {
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
    return parsed as CreateWorkspaceBody
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

/** POST /git-suite/create-workspace: register the picked repository directory as a DSH workspace. */
export function createWorkspaceHandler(
  context: RouteContext,
  registry: WorkspaceRegistry | undefined,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (!admitHeaders(name => header(req, name))) {
      await send(res, json({
        ok: false,
        error: { code: 'forbidden', message: 'This request is not allowed to create a workspace.' },
      }, 403))
      return
    }
    if (req.method !== 'POST') {
      await send(res, json({
        ok: false,
        error: { code: 'method-not-allowed', message: 'Creating a workspace requires POST.' },
      }, 405))
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    res.once('close', () => controller.abort())
    try {
      const body = await readJson(req)
      const rawPath = typeof body.path === 'string' ? body.path : ''
      if (registry === undefined || typeof registry.create !== 'function') {
        throw new RouteError(500, 'workspace-unavailable', 'The DSH workspace registry is not available.')
      }
      const repo = await resolveRepository(context, rawPath, controller.signal)
      const title = basename(repo.root)
      try {
        await registry.create(repo.root, title)
      } catch (error) {
        throw new RouteError(500, 'workspace-create-failed', error instanceof Error ? error.message : 'Could not create the workspace.')
      }
      await send(res, json({ ok: true, path: repo.root, title }))
    } catch (error) {
      await send(res, failure(error))
    } finally {
      clearTimeout(timeout)
    }
  }
}

import type { IncomingMessage, ServerResponse } from 'node:http'
import { RouteError } from './errors.js'
import { detectForge } from './forge/detect.js'
import { deletePull } from './forge/index.js'
import { resolveRemote } from './forge/remote.js'
import { resolveForgeToken } from './forge/token.js'
import { admitHeaders, failure, json, readJsonBody, sendResponse } from './http.js'
import { resolveRepository } from './repository.js'
import type { RouteContext } from './types.js'

interface DeleteBody {
  path?: unknown
  remote?: unknown
  number?: unknown
}

function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name]
  if (value === undefined) return null
  return Array.isArray(value) ? value.join(', ') : value
}

/**
 * POST /git-suite/pr-delete: permanently delete a merge request. Only GitLab
 * exposes a delete API; GitHub and Gitee can only close a pull request.
 */
export function createPullDeleteHandler(context: RouteContext): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (!admitHeaders(name => header(req, name))) {
      await sendResponse(res, json({
        ok: false,
        error: { code: 'forbidden', message: 'This request is not allowed to delete a pull request.' },
      }, 403))
      return
    }
    if (req.method !== 'POST') {
      await sendResponse(res, json({
        ok: false,
        error: { code: 'method-not-allowed', message: 'Deleting a pull request requires POST.' },
      }, 405))
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    res.once('close', () => controller.abort())
    const signal = controller.signal
    try {
      const body = await readJsonBody<DeleteBody>(req, 16 * 1024)
      const number = typeof body.number === 'number' ? body.number : Number.NaN
      if (!Number.isInteger(number) || number <= 0 || number > 2_147_483_647) {
        throw new RouteError(400, 'invalid-number', 'That pull request number is not valid.')
      }

      const repo = await resolveRepository(context, typeof body.path === 'string' ? body.path : '', signal)
      const remote = await resolveRemote(repo.root, typeof body.remote === 'string' ? body.remote : '', signal)
      const target = detectForge(remote.url)
      if (target === null) {
        throw new RouteError(400, 'forge-unsupported', 'This remote is not hosted on a supported forge.', { remote: remote.name })
      }
      if (target.provider !== 'gitlab') {
        throw new RouteError(
          400,
          'forge-unsupported',
          'Only GitLab merge requests can be deleted; GitHub and Gitee pull requests can only be closed.',
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

      try {
        await deletePull(target, number, token, signal)
      } catch (error) {
        if (error instanceof RouteError) throw error.withDetails({ remote: remote.name })
        throw error
      }
      await sendResponse(res, json({ ok: true, number }))
    } catch (error) {
      await sendResponse(res, failure(error))
    } finally {
      clearTimeout(timeout)
    }
  }
}

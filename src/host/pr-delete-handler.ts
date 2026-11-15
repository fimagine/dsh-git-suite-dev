import type { IncomingMessage, ServerResponse } from 'node:http'
import { RouteError } from './errors.js'
import { deletePull, getPull } from './forge/index.js'
import { resetForgeCache } from './forge/http.js'
import { parsePullNumber, withForgePost } from './forge-post.js'
import type { RouteContext } from './types.js'

interface DeleteBody {
  path?: unknown
  remote?: unknown
  number?: unknown
}

/**
 * POST /git-suite/pr-delete: permanently delete a merge request. Only GitLab
 * exposes a delete API; GitHub and Gitee can only close a pull request.
 */
export function createPullDeleteHandler(context: RouteContext): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return (req, res) => withForgePost<DeleteBody>(req, res, context, {
    maxBytes: 16 * 1024,
    provider: 'gitlab',
    providerMessage: 'Only GitLab merge requests can be deleted; GitHub and Gitee pull requests can only be closed.',
    forbidden: 'This request is not allowed to delete a pull request.',
    methodMessage: 'Deleting a pull request requires POST.',
    handle: async (body, { target, token, signal }) => {
      const number = parsePullNumber(body.number)
      const detail = await getPull(target, number, token, signal, true)
      if (detail.state === 'merged') {
        throw new RouteError(409, 'pull-delete-merged', 'Merged merge requests cannot be deleted.', { number })
      }
      try {
        await deletePull(target, number, token, signal)
      } catch (error) {
        if (error instanceof RouteError && error.code === 'forge-request-failed') {
          const status = error.details?.status
          if (status === 403 || status === 405) {
            throw new RouteError(403, 'pull-delete-forbidden', 'GitLab refused to delete this merge request; project owner or administrator permission is required.', { number })
          }
        }
        throw error
      }
      resetForgeCache()
      return { number }
    },
  })
}

import type { IncomingMessage, ServerResponse } from 'node:http'
import { RouteError } from './errors.js'
import { deletePull } from './forge/index.js'
import { withForgePost } from './forge-post.js'
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
      const number = typeof body.number === 'number' ? body.number : Number.NaN
      if (!Number.isInteger(number) || number <= 0 || number > 2_147_483_647) {
        throw new RouteError(400, 'invalid-number', 'That pull request number is not valid.')
      }
      await deletePull(target, number, token, signal)
      return { number }
    },
  })
}

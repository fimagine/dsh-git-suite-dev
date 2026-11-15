import type { IncomingMessage, ServerResponse } from 'node:http'
import { RouteError } from './errors.js'
import { decideGiteePull } from './forge/index.js'
import { withForgePost } from './forge-post.js'
import type { RouteContext } from './types.js'

interface DecisionBody {
  path?: unknown
  remote?: unknown
  number?: unknown
  action?: unknown
}

/** POST /git-suite/pr-gitee-decision: mark review or test as passed on Gitee. */
export function createGiteeDecisionHandler(context: RouteContext): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return (req, res) => withForgePost<DecisionBody>(req, res, context, {
    maxBytes: 16 * 1024,
    provider: 'gitee',
    providerMessage: 'Review and test approvals are only available on Gitee.',
    forbidden: 'This request is not allowed to update a pull request.',
    methodMessage: 'Updating a pull request requires POST.',
    handle: async (body, { target, token, signal }) => {
      const action = body.action === 'review' || body.action === 'test' ? body.action : null
      if (action === null) throw new RouteError(400, 'invalid-action', 'Choose the review or test action.')
      const number = typeof body.number === 'number' ? body.number : Number.NaN
      if (!Number.isInteger(number) || number <= 0 || number > 2_147_483_647) {
        throw new RouteError(400, 'invalid-number', 'That pull request number is not valid.')
      }
      await decideGiteePull(target, number, token, action, signal)
      return { action, number }
    },
  })
}

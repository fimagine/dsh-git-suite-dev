import type { HostContext, WorkspaceRegistry, WorkspaceRegistryEntry } from './dsh.js'
import { createCloneHandler } from './clone-handler.js'
import { createBranchActionHandler } from './branch-action-handler.js'
import { createBranchHandler, createCheckoutHandler, createTagHandler } from './commit-actions.js'
import { createWorkspaceHandler } from './create-workspace-handler.js'
import { createGenerateMessageHandler } from './generate-handler.js'
import { createPickDirectoryHandler } from './pick-handler.js'
import { createRemoteHandler } from './remote-handler.js'
import { createResource } from './resource.js'
import { createSwitchHandler } from './switch-handler.js'
import { createSyncHandler } from './sync-handler.js'
import { createWorkspaceActionHandler } from './workspace-action.js'
import type { RouteContext, WorkspaceRef } from './types.js'

const ROUTE_PATH = '/git-suite'
const SWITCH_PATH = '/git-suite/switch'
const ACTION_PATH = '/git-suite/action'
const CLONE_PATH = '/git-suite/clone'
const GENERATE_PATH = '/git-suite/generate-message'
const PICK_PATH = '/git-suite/pick-directory'
const CREATE_WORKSPACE_PATH = '/git-suite/create-workspace'
const TAG_PATH = '/git-suite/tag'
const BRANCH_PATH = '/git-suite/branch'
const CHECKOUT_PATH = '/git-suite/checkout'
const SYNC_PATH = '/git-suite/sync'
const REMOTE_PATH = '/git-suite/remote'
const BRANCH_ACTION_PATH = '/git-suite/branch-action'

export const inject = ['webServer', 'workingDirectory', 'directoryPicker', 'llm', 'agentDefaultModel']

/** Register the read-only Git suite route with the host web server. */
export function apply(ctx: HostContext): void {
  const workspaceRegistry = ctx.get<WorkspaceRegistry>('workspaceRegistry')
  const listWorkspaces = (): WorkspaceRegistryEntry[] => {
    try {
      return workspaceRegistry?.list?.() ?? []
    } catch {
      return []
    }
  }
  const context: RouteContext = {
    workspaces: (): WorkspaceRef[] => listWorkspaces(),
    defaultPath(): string {
      const workspace = listWorkspaces()[0]
      return workspace?.path || ctx.workingDirectory.defaultDirectory || process.cwd()
    },
  }
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE_PATH,
    resource: createResource(context),
  }), 'git-suite: read-only route')
  // Resource routes are GET/HEAD only; the switch POST needs a Node handler.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: SWITCH_PATH,
    handler: createSwitchHandler(context),
  }), 'git-suite: switch route')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ACTION_PATH,
    handler: createWorkspaceActionHandler(context),
  }), 'git-suite: workspace actions route')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: CLONE_PATH,
    handler: createCloneHandler(),
  }), 'git-suite: clone route')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: GENERATE_PATH,
    handler: createGenerateMessageHandler(context, ctx.llm, ctx.agentDefaultModel),
  }), 'git-suite: generate message route')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: PICK_PATH,
    handler: createPickDirectoryHandler(context, ctx.directoryPicker, listWorkspaces),
  }), 'git-suite: pick directory route')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: CREATE_WORKSPACE_PATH,
    handler: createWorkspaceHandler(context, workspaceRegistry),
  }), 'git-suite: create workspace route')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: TAG_PATH,
    handler: createTagHandler(context),
  }), 'git-suite: tag route')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: BRANCH_PATH,
    handler: createBranchHandler(context),
  }), 'git-suite: branch route')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: CHECKOUT_PATH,
    handler: createCheckoutHandler(context),
  }), 'git-suite: checkout route')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: SYNC_PATH,
    handler: createSyncHandler(context),
  }), 'git-suite: sync route')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: REMOTE_PATH,
    handler: createRemoteHandler(context),
  }), 'git-suite: remote route')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: BRANCH_ACTION_PATH,
    handler: createBranchActionHandler(context),
  }), 'git-suite: branch action route')
}

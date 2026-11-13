import type { HostContext, WorkspaceRegistry, WorkspaceRegistryEntry } from './dsh.js'
import { createResource } from './resource.js'
import type { RouteContext, WorkspaceRef } from './types.js'

const ROUTE_PATH = '/git-log'

export const inject = ['webServer', 'workingDirectory']

/** Register the read-only Git log route with the host web server. */
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
  }), 'git-log-viewer: read-only route')
}

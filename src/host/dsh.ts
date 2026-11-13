/**
 * The small slice of the DSH host API this plugin uses. These declarations are
 * maintained here, against the DSH 0.2.x plugin context, instead of pulling the
 * whole Harness package graph into the plugin.
 */

export interface WorkspaceRegistryEntry {
  id: string
  title: string
  path: string
}

export interface WorkspaceRegistry {
  list?(): WorkspaceRegistryEntry[]
}

export interface WebServerRoute {
  kind: 'exact' | 'prefix'
  path: string
  resource(request: Request): Response | Promise<Response>
}

export interface WebServer {
  register(route: WebServerRoute): () => void
}

export interface WorkingDirectoryService {
  defaultDirectory?: string
}

export interface HostContext {
  get<T>(name: string): T | undefined
  effect(setup: () => (() => void) | void, label?: string): void
  webServer: WebServer
  workingDirectory: WorkingDirectoryService
}

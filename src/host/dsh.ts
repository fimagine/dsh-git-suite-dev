/**
 * The small slice of the DSH host API this plugin uses. These declarations are
 * maintained here, against the DSH 0.2.x plugin context, instead of pulling the
 * whole Harness package graph into the plugin.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

export interface WorkspaceRegistryEntry {
  id: string
  title: string
  path: string
}

export interface WorkspaceRegistry {
  list?(): WorkspaceRegistryEntry[]
}

export interface NativeDirectoryPicker {
  kind: 'native'
  pick(signal?: AbortSignal): Promise<string | null>
}

export interface BrowseDirectoryPicker {
  kind: 'browse'
}

export type DirectoryPickerCapability = NativeDirectoryPicker | BrowseDirectoryPicker

export interface DirectoryPickerService {
  capability(): DirectoryPickerCapability
}

export interface WebServerResourceRoute {
  kind: 'exact' | 'prefix'
  path: string
  /** DSH answers only GET and HEAD for resource routes. */
  resource(request: Request): Response | Promise<Response>
}

export interface WebServerHandlerRoute {
  kind: 'exact' | 'prefix'
  path: string
  /** A full Node handler; use this for non-GET methods such as branch switching. */
  handler(req: IncomingMessage, res: ServerResponse): void | Promise<void>
}

export type WebServerRoute = WebServerResourceRoute | WebServerHandlerRoute

export interface WebServer {
  register(route: WebServerRoute): () => void
}

export interface WorkingDirectoryService {
  defaultDirectory?: string
}

/** One raw chunk from the provider-neutral LLM stream; only text deltas and the terminal finish are used here. */
export interface LlmStreamChunk {
  type: string
  text?: string
  reason?: {
    kind?: string
    failure?: { message?: string; code?: string }
  }
}

export interface LlmGenerateOptions {
  provider: string
  model: string
  system?: string
  messages: { role: 'user'; content: { type: 'text'; text: string }[] }[]
  maxTokens?: number
  temperature?: number
  reasoningEffort?: string
  signal?: AbortSignal
}

/** The provider-neutral model-call service (`ctx.llm`). */
export interface LlmService {
  stream(options: LlmGenerateOptions): AsyncIterable<LlmStreamChunk>
}

/** The deployment default model selection (`ctx.agentDefaultModel`). */
export interface AgentDefaultModelService {
  currentSelection(): { provider: string; model: string; reasoningEffort?: string }
}

export interface HostContext {
  get<T>(name: string): T | undefined
  effect(setup: () => (() => void) | void, label?: string): void
  webServer: WebServer
  workingDirectory: WorkingDirectoryService
  directoryPicker: DirectoryPickerService
  llm: LlmService
  agentDefaultModel: AgentDefaultModelService
}

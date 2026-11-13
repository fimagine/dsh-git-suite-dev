import type * as React from 'react'
import type { LocaleKey } from './locales/en.js'

/** The `require` function DSH hands each client factory. */
export interface ClientRequire {
  (specifier: 'react'): typeof React
  (specifier: string): unknown
}

export interface ModuleDefinition {
  id: string
  factory(require: ClientRequire): unknown
}

export interface ModuleLoader {
  load(definition: ModuleDefinition): void
}

export interface LocaleDictionaries {
  en: Record<LocaleKey, string>
  zh: Record<LocaleKey, string>
}

export interface LocaleService {
  register(namespace: string, dictionaries: LocaleDictionaries): () => void
  bind(namespace: string): (key: LocaleKey) => string
}

export interface SlotRegistrationOptions {
  name: string
  key?: string
  id?: string
  order?: number
  label?: () => string
  locale?: string
}

/** The minimal slot props this plugin's components receive from the host. */
export interface IconProps {
  size: number
}

export interface SlotsService {
  inject(slot: string, setup: () => unknown): void
  register(options: SlotRegistrationOptions, component: React.ComponentType<never>): () => void
}

/** One entry box the right sidebar's Start page offers. */
export interface SidebarRightGuideEntry {
  id: string
  order: number
  title(): string
  description?(): string
  icon?: React.ComponentType<IconProps>
}

export interface SidebarRightTabDefinition {
  id: string
  kind: string
  priority?: 'extension' | 'builtin' | 'fallback'
  multiple?: boolean
  keepMounted?: boolean
  title(address: string): string
  guide?: readonly SidebarRightGuideEntry[]
}

/** The right sidebar's tab-type registry (stage one of a tab type's registration). */
export interface SidebarRightTabsService {
  register(definition: SidebarRightTabDefinition): () => void
}

export interface ClientContext {
  effect(setup: () => (() => void) | void, label?: string): void
  /** Run `setup` in a child fiber that waits for every named service. */
  inject(deps: readonly string[], setup: (scope: ClientContext) => void): void
  locale: LocaleService
  slots: SlotsService
  /** Present only inside `inject(['sidebarRightTabs'], …)`. */
  sidebarRightTabs?: SidebarRightTabsService
}

export interface ClientPlugin {
  inject: string[]
  apply(ctx: ClientContext): void
}

declare global {
  interface Window {
    __ModuleLoader__: ModuleLoader
  }
}

export function moduleLoader(): ModuleLoader {
  return window.__ModuleLoader__
}

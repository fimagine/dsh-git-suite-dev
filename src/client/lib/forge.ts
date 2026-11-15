import type { ForgeInfo, RemoteGroup } from '../types.js'

/** The forge a remote resolves to, when the host reported one. */
export function forgeOf(remotes: readonly RemoteGroup[], name: string): ForgeInfo | null {
  return remotes.find(remote => remote.name === name)?.forge ?? null
}

/** Remotes whose host is a supported forge. */
export function supportedRemotes(remotes: readonly RemoteGroup[]): RemoteGroup[] {
  return remotes.filter(remote => remote.forge !== null && remote.forge !== undefined)
}

/** Whether the PR view has anything to show for this repository. */
export function hasForge(remotes: readonly RemoteGroup[]): boolean {
  return supportedRemotes(remotes).length > 0
}

/**
 * Pick the remote the PR view starts on: the current branch's upstream remote
 * when it is supported, otherwise origin, otherwise the first supported remote.
 */
export function defaultForgeRemote(remotes: readonly RemoteGroup[], upstream: string): string {
  const supported = supportedRemotes(remotes)
  if (supported.length === 0) return ''
  const slash = upstream.indexOf('/')
  const upstreamRemote = slash > 0 ? upstream.slice(0, slash) : ''
  if (upstreamRemote !== '' && supported.some(remote => remote.name === upstreamRemote)) return upstreamRemote
  if (supported.some(remote => remote.name === 'origin')) return 'origin'
  return supported[0]?.name ?? ''
}

/** Brand name shown next to the repository in the PR view. */
export function forgeLabel(provider: ForgeInfo['provider']): string {
  if (provider === 'github') return 'GitHub'
  if (provider === 'gitee') return 'Gitee'
  return 'GitLab'
}

import type { ForgeInfo, ForgeProvider } from '../types.js'

/** A remote URL reduced to the host and the project path on that host. */
export interface RemoteLocation {
  host: string
  path: string
}

/** A supported remote with the API base derived from its host. */
export interface ForgeTarget extends ForgeInfo {
  apiBase: string
  /** Full project path: `owner/repo`, or a GitLab namespace path. */
  projectPath: string
}

const MAX_REMOTE_LENGTH = 2048

/**
 * Parse the remote transports Git can use without running a command:
 * `https://host/owner/repo.git`, `ssh://git@host/owner/repo.git`, and the
 * scp-like `git@host:owner/repo.git`. Local paths and unsupported transports
 * return null.
 */
export function parseRemoteLocation(remoteUrl: string): RemoteLocation | null {
  const value = remoteUrl.trim()
  if (value === '' || value.length > MAX_REMOTE_LENGTH) return null
  // A Windows drive letter is a local path, not an scp-like remote.
  if (/^[A-Za-z]:[\\/]/.test(value)) return null

  if (value.includes('://')) {
    try {
      const parsed = new URL(value)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:' && parsed.protocol !== 'ssh:' && parsed.protocol !== 'git:') {
        return null
      }
      if (parsed.hostname === '') return null
      // HTTPS credentials are stored per host (including a non-default port);
      // SSH is only used to reach the host, whose web API stays on HTTPS.
      const host = parsed.protocol === 'https:' || parsed.protocol === 'http:'
        ? parsed.host.toLowerCase()
        : parsed.hostname.toLowerCase()
      return { host, path: cleanPath(parsed.pathname) }
    } catch {
      return null
    }
  }

  const scp = /^(?:[A-Za-z0-9._-]+@)?([A-Za-z0-9._-]+):(.+)$/.exec(value)
  if (scp === null) return null
  const host = (scp[1] ?? '').toLowerCase()
  const path = cleanPath(scp[2] ?? '')
  if (host === '' || path === '') return null
  return { host, path }
}

/** Strip leading/trailing slashes and the optional `.git` suffix. */
function cleanPath(raw: string): string {
  let path = raw.replace(/^\/+/, '').replace(/\/+$/, '')
  if (path.endsWith('.git')) path = path.slice(0, -4)
  return path
}

interface ProviderRule {
  provider: ForgeProvider
  apiBase(host: string): string
}

/** Match a host name to a forge; self-hosted instances are recognized by prefix. */
function providerFor(host: string): ProviderRule | null {
  const name = host.replace(/:\d+$/, '')
  if (name === 'github.com') return { provider: 'github', apiBase: () => 'https://api.github.com' }
  if (name === 'gitee.com') return { provider: 'gitee', apiBase: () => 'https://gitee.com/api/v5' }
  if (name === 'gitlab.com') return { provider: 'gitlab', apiBase: () => 'https://gitlab.com/api/v4' }
  // GitHub Enterprise, self-managed GitLab, and Gitee Enterprise keep their API
  // on the instance itself.
  if (name.startsWith('github.')) return { provider: 'github', apiBase: value => `https://${host}/api/v3` }
  if (name.startsWith('gitlab.')) return { provider: 'gitlab', apiBase: value => `https://${host}/api/v4` }
  if (name.startsWith('gitee.')) return { provider: 'gitee', apiBase: value => `https://${host}/api/v5` }
  return null
}

/** Resolve a remote URL to a forge target, or null when the host is not supported. */
export function detectForge(remoteUrl: string): ForgeTarget | null {
  const location = parseRemoteLocation(remoteUrl)
  if (location === null) return null
  const rule = providerFor(location.host)
  if (rule === null) return null

  const segments = location.path.split('/').filter(segment => segment !== '')
  if (segments.length < 2) return null
  const repo = segments[segments.length - 1] ?? ''
  const owner = rule.provider === 'gitlab'
    ? segments.slice(0, -1).join('/')
    : segments[0] ?? ''
  if (repo === '' || owner === '') return null
  // GitHub and Gitee URLs are `host/owner/repo`; extra segments belong to a
  // branch or path and are ignored. GitLab keeps the whole namespace path.
  const projectPath = rule.provider === 'gitlab' ? location.path : `${owner}/${repo}`

  return {
    provider: rule.provider,
    host: location.host,
    owner,
    repo,
    projectPath,
    webUrl: `https://${location.host}/${projectPath}`,
    apiBase: rule.apiBase(location.host),
  }
}

/** Drop the API details before a target reaches the client. */
export function toForgeInfo(target: ForgeTarget): ForgeInfo {
  return {
    provider: target.provider,
    host: target.host,
    owner: target.owner,
    repo: target.repo,
    webUrl: target.webUrl,
  }
}

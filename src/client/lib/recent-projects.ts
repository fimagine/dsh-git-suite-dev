const RECENT_PROJECTS_KEY = 'dsh.git-suite.recent-projects.v1'
const RECENT_PROJECTS_COOKIE = 'dsh_git_suite_recent_projects'
// Keys used before the plugin was renamed; read once so existing recents survive.
const LEGACY_PROJECTS_KEY = 'dsh.git-log-viewer.recent-projects.v1'
const LEGACY_PROJECTS_COOKIE = 'dsh_git_log_recent_projects'

export const RECENT_PROJECTS_LIMIT = 8

function readCookie(name: string): string | null {
  try {
    const prefix = `${name}=`
    for (const part of document.cookie.split('; ')) {
      if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length))
    }
  } catch {
    return null
  }
  return null
}

/** Restore the recent-project list, preferring localStorage and falling back to a cookie. */
export function readRecentProjects(): string[] {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(RECENT_PROJECTS_KEY) ?? window.localStorage.getItem(LEGACY_PROJECTS_KEY)
  } catch {
    raw = null
  }
  if (raw === null || raw === '') raw = readCookie(RECENT_PROJECTS_COOKIE) ?? readCookie(LEGACY_PROJECTS_COOKIE)
  if (raw === null || raw === '') return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    const seen = new Set<string>()
    return value
      .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
      .filter((item) => {
        const key = item.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, RECENT_PROJECTS_LIMIT)
  } catch {
    return []
  }
}

/** Persist the list in both stores so one restricted browser context still remembers it. */
export function writeRecentProjects(projects: readonly string[]): void {
  const serialized = JSON.stringify(projects)
  try {
    document.cookie = `${RECENT_PROJECTS_COOKIE}=${encodeURIComponent(serialized)}; Max-Age=31536000; Path=/; SameSite=Lax`
  } catch {
    // Cookies can be disabled; localStorage below is the fallback.
  }
  try {
    window.localStorage.setItem(RECENT_PROJECTS_KEY, serialized)
  } catch {
    // Storage can be unavailable in a private or restricted browser context.
  }
}

/** Move `path` to the front, case-insensitively de-duplicated, and cap the list. */
export function addRecentProject(current: readonly string[], path: string): string[] {
  const key = path.toLowerCase()
  return [path, ...current.filter(item => item.toLowerCase() !== key)].slice(0, RECENT_PROJECTS_LIMIT)
}

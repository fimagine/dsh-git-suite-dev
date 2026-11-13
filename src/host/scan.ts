import { readdir, stat } from 'node:fs/promises'
import { basename, join, normalize } from 'node:path'
import { RouteError } from './errors.js'
import type { Project, RouteContext, WorkspaceRef } from './types.js'

const SCAN_MAX_DEPTH = 3
const SCAN_MAX_ENTRIES = 2500
const SCAN_MAX_PROJECTS = 100
const SCAN_SKIP = new Set([
  '$Recycle.Bin',
  'AppData',
  'Application Data',
  'DerivedData',
  'Pods',
  'Program Files',
  'Program Files (x86)',
  'System Volume Information',
  'Windows',
  'bower_components',
  'build',
  'coverage',
  'dist',
  'jspm_packages',
  'node_modules',
  'obj',
  'out',
  'target',
  'vendor',
])

export interface ProjectScan {
  ok: true
  workspaces: WorkspaceRef[]
  projects: Project[]
  truncated: boolean
  defaultPath: string
}

/** Case-insensitive key on Windows, so one repository is not listed twice. */
function projectKey(path: string): string {
  const normalized = normalize(path)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

async function isGitProject(path: string): Promise<boolean> {
  try {
    const info = await stat(join(path, '.git'))
    return info.isDirectory() || info.isFile()
  } catch {
    return false
  }
}

/**
 * Scan registered workspaces for Git projects, including nested ones, with
 * bounded depth and entry counts so a huge workspace cannot stall the route.
 */
export async function scanProjects(context: RouteContext, signal: AbortSignal): Promise<ProjectScan> {
  const workspaces = context.workspaces()
  const projects: Project[] = []
  const seen = new Set<string>()
  let visited = 0
  let truncated = false

  for (const workspace of workspaces) {
    if (projects.length >= SCAN_MAX_PROJECTS) {
      truncated = true
      break
    }

    const queue: Array<{ path: string; depth: number }> = [{ path: workspace.path, depth: 0 }]
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      if (signal.aborted) throw new RouteError(499, 'cancelled', 'The request was cancelled.')
      if (visited >= SCAN_MAX_ENTRIES || projects.length >= SCAN_MAX_PROJECTS) {
        truncated = true
        break
      }

      const current = queue[cursor]
      if (current === undefined) break
      visited += 1

      let info
      try {
        info = await stat(current.path)
      } catch {
        continue
      }
      if (!info.isDirectory()) continue

      if (await isGitProject(current.path)) {
        const key = projectKey(current.path)
        if (!seen.has(key)) {
          seen.add(key)
          projects.push({
            path: normalize(current.path),
            name: basename(current.path) || current.path,
            workspaceId: workspace.id,
            workspaceTitle: workspace.title,
            nested: current.depth > 0,
          })
        }
        continue
      }

      if (current.depth >= SCAN_MAX_DEPTH) continue

      let entries
      try {
        entries = await readdir(current.path, { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.isSymbolicLink()) continue
        if (entry.name.startsWith('.') || SCAN_SKIP.has(entry.name)) continue
        queue.push({ path: join(current.path, entry.name), depth: current.depth + 1 })
      }
    }
  }

  return {
    ok: true,
    workspaces: workspaces.map(workspace => ({ id: workspace.id, title: workspace.title, path: workspace.path })),
    projects,
    truncated,
    defaultPath: context.defaultPath(),
  }
}

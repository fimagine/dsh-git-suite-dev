import type { Branch, Project, Repo, Translate } from '../types.js'

export interface ProjectGroups {
  recent: Project[]
  workspace: Project[]
}

export interface BranchOption {
  ref: string
  name: string
}

/** Last path segment, tolerating both Windows and POSIX separators. */
export function pathName(path: string): string {
  const parts = String(path).split(/[\\/]+/).filter(Boolean)
  return parts[parts.length - 1] || String(path)
}

export function projectLabel(project: Pick<Project, 'name' | 'path' | 'workspaceTitle'>): string {
  const name = project.name || pathName(project.path)
  return project.workspaceTitle && project.workspaceTitle !== name
    ? `${name} — ${project.workspaceTitle}`
    : name
}

/** Split projects into recently opened and remaining workspace entries, keeping scanned metadata. */
export function buildProjectGroups(projects: readonly Project[], recentPaths: readonly string[]): ProjectGroups {
  const scannedByPath = new Map(projects.map(project => [project.path.toLowerCase(), project]))
  const recentKeys = new Set<string>()
  const recent = recentPaths.map((path) => {
    const key = path.toLowerCase()
    recentKeys.add(key)
    return scannedByPath.get(key) ?? { path, name: pathName(path), workspaceTitle: '', nested: false }
  })
  const workspace = projects.filter(project => !recentKeys.has(project.path.toLowerCase()))
  return { recent, workspace }
}

/** A manually typed path that the scan did not return, so the select can still show it. */
export function findCurrentProject(groups: ProjectGroups, selectedPath: string): Project | null {
  if (selectedPath === '') return null
  const known = new Set([...groups.recent, ...groups.workspace].map(project => project.path.toLowerCase()))
  return known.has(selectedPath.toLowerCase()) ? null : { path: selectedPath, name: pathName(selectedPath) }
}

export function shortRefName(ref: string): string {
  return ref.replace(/^refs\/(?:heads|remotes)\//, '')
}

/** The selected ref when it is not one of the pseudo entries or a known branch. */
export function customBranchOf(branches: readonly Branch[], selection: string): BranchOption | null {
  if (selection === 'HEAD' || selection === '__all__' || selection === '__remotes__') return null
  if (branches.some(branch => branch.ref === selection)) return null
  return { ref: selection, name: shortRefName(selection) }
}

export function currentBranchLabel(repo: Repo | null, t: Translate): string {
  return repo && repo.branch && repo.branch !== 'detached'
    ? `${t('currentBranch')}: ${repo.branch}`
    : t('currentBranch')
}

export function branchLabelFor(
  input: { selection: string; branches: readonly Branch[]; repo: Repo | null; customBranch: BranchOption | null },
  t: Translate,
): string {
  const { selection } = input
  if (selection === '__all__') return t('allBranches')
  if (selection === '__remotes__') return t('allRemoteBranches')
  if (selection === 'HEAD') return currentBranchLabel(input.repo, t)
  const selected = input.branches.find(branch => branch.ref === selection)
  return selected?.name ?? input.customBranch?.name ?? shortRefName(selection)
}

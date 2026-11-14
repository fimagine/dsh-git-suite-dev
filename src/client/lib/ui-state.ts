/**
 * Persisted panel state. Repository-specific values live in a bucket per
 * normalized repository root (`repos[<key>]`), while true preferences — the
 * global preference.
 */

export type ViewMode = 'history' | 'workspace'
export type SortMode = 'date' | 'topo'

/** State that belongs to one repository. */
export interface RepoUiState {
  viewMode?: ViewMode
  limit?: number
  sort?: SortMode
  showRemotes?: boolean
  treeWidth?: number
  treeHeight?: number
  detailRatio?: number
  /** Width of the staged/unstaged column in the commit view. */
  commitFilesWidth?: number
  /** Height of the staged list in the commit view. */
  commitStagedHeight?: number
  /** Height of the commit message form in the commit view. */
  commitFormHeight?: number
  /** Height the user dragged the form to in the stacked (sidebar/narrow) layout. */
  commitNarrowHeight?: number
  /** Height of the file column in the stacked layout, above the diff. */
  commitFilesHeight?: number
  /** Ref-tree section expansion for this repository. */
  openSections?: Record<string, boolean>
  /** Collapsed ref-tree folders for this repository. */
  collapsedFolders?: Record<string, boolean>
  /** The unsent commit message of this repository. */
  draft?: string
}

/** State shared by every repository. */
export interface UiState {
  /** Diff layout: unified rows or a side-by-side split. */
  diffMode?: 'unified' | 'split'
  /** Per-repository buckets keyed by `normalizeRepoKey(repoRoot)`. */
  repos?: Record<string, RepoUiState>
}

const STORAGE_KEY = 'dsh-git-suite:ui-state'

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function stringRecord(value: unknown): Record<string, string> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const out: Record<string, string> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') out[key] = item
  }
  return out
}

function booleanRecord(value: unknown): Record<string, boolean> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const out: Record<string, boolean> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'boolean') out[key] = item
  }
  return out
}

/** Normalize a repository root into a stable bucket key. */
export function normalizeRepoKey(path: string): string {
  const slashed = path.trim().replace(/\\/g, '/').replace(/\/+$/, '')
  // Windows paths are case-insensitive; POSIX paths are not.
  return /^[a-z]:\//i.test(slashed) ? slashed.toLowerCase() : slashed
}

let activeRepo: string | null = null

/** Remember the repository the panel is showing, so hooks can read its bucket. */
export function setActiveRepo(repoRoot: string | null): void {
  activeRepo = repoRoot === null || repoRoot === '' ? null : normalizeRepoKey(repoRoot)
}

export function getActiveRepo(): string | null {
  return activeRepo
}

interface RawState {
  global: UiState
  /** Pre-bucket flat fields, used as a fallback for every repository. */
  legacy: RepoUiState
  /** Pre-bucket commitDrafts: Record<repoRoot, message>. */
  legacyDrafts?: Record<string, string>
}

/** Parse the stored JSON once; unknown or malformed fields are ignored. */
function readRaw(): RawState {
  const empty: RawState = { global: {}, legacy: {} }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return empty
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return empty
    const source = parsed as Record<string, unknown>
    const global: UiState = {}
    const legacy: RepoUiState = {}

    if (source.diffMode === 'unified' || source.diffMode === 'split') global.diffMode = source.diffMode

    if (typeof source.repos === 'object' && source.repos !== null && !Array.isArray(source.repos)) {
      const repos: Record<string, RepoUiState> = {}
      for (const [key, value] of Object.entries(source.repos as Record<string, unknown>)) {
        const bucket = parseRepoState(value)
        if (bucket !== undefined) repos[normalizeRepoKey(key)] = bucket
      }
      if (Object.keys(repos).length > 0) global.repos = repos
    }

    // Flat fields are the old schema: read them as a fallback for every repo.
    if (source.viewMode === 'history' || source.viewMode === 'workspace') legacy.viewMode = source.viewMode
    const limit = finite(source.limit)
    if (limit !== undefined && limit > 0) legacy.limit = Math.round(limit)
    if (source.sort === 'date' || source.sort === 'topo') legacy.sort = source.sort
    if (typeof source.showRemotes === 'boolean') legacy.showRemotes = source.showRemotes
    for (const key of ['treeWidth', 'treeHeight', 'detailRatio', 'commitFilesWidth', 'commitStagedHeight', 'commitFormHeight', 'commitNarrowHeight', 'commitFilesHeight'] as const) {
      const value = finite(source[key])
      if (value !== undefined) legacy[key] = value
    }
    const openSections = booleanRecord(source.openSections)
    if (openSections !== undefined) legacy.openSections = openSections
    const collapsedFolders = booleanRecord(source.collapsedFolders)
    if (collapsedFolders !== undefined) legacy.collapsedFolders = collapsedFolders
    const drafts = stringRecord(source.commitDrafts)

    return { global, legacy, legacyDrafts: drafts }
  } catch {
    return empty
  }
}

function parseRepoState(value: unknown): RepoUiState | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const source = value as Record<string, unknown>
  const bucket: RepoUiState = {}
  if (source.viewMode === 'history' || source.viewMode === 'workspace') bucket.viewMode = source.viewMode
  const limit = finite(source.limit)
  if (limit !== undefined && limit > 0) bucket.limit = Math.round(limit)
  if (source.sort === 'date' || source.sort === 'topo') bucket.sort = source.sort
  if (typeof source.showRemotes === 'boolean') bucket.showRemotes = source.showRemotes
  for (const key of ['treeWidth', 'treeHeight', 'detailRatio', 'commitFilesWidth', 'commitStagedHeight', 'commitFormHeight', 'commitNarrowHeight', 'commitFilesHeight'] as const) {
    const value = finite(source[key])
    if (value !== undefined) bucket[key] = value
  }
  const openSections = booleanRecord(source.openSections)
  if (openSections !== undefined) bucket.openSections = openSections
  const collapsedFolders = booleanRecord(source.collapsedFolders)
  if (collapsedFolders !== undefined) bucket.collapsedFolders = collapsedFolders
  if (typeof source.draft === 'string') bucket.draft = source.draft
  return bucket
}

/** Read the global preferences. */
export function readUiState(): UiState {
  return readRaw().global
}

/** Merge global preference changes into storage; storage failures are ignored. */
export function writeUiState(patch: Partial<UiState>): void {
  try {
    const raw = readRaw()
    const next: UiState = { ...raw.global, ...patch }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // A disabled or full localStorage must not break the panel.
  }
}

/**
 * Read one repository's bucket, falling back to the pre-bucket flat values so
 * existing installs keep their settings.
 */
export function readRepoUiState(repo?: string | null): RepoUiState {
  const raw = readRaw()
  const key = repo === undefined ? activeRepo : repo === null || repo === '' ? null : normalizeRepoKey(repo)
  const bucket = key === null ? undefined : raw.global.repos?.[key]
  const merged: RepoUiState = { ...raw.legacy, ...bucket }
  if (merged.draft === undefined && typeof repo === 'string' && repo !== '') {
    // Very old builds kept `commitDrafts: Record<repoRoot, message>` with raw paths.
    const draft = raw.legacyDrafts?.[repo]
    if (draft !== undefined) merged.draft = draft
  }
  return merged
}

/** Merge a change into one repository's bucket; a missing key is a no-op. */
export function writeRepoUiState(patch: Partial<RepoUiState>, repo?: string | null): void {
  const key = repo === undefined ? activeRepo : repo === null || repo === '' ? null : normalizeRepoKey(repo)
  if (key === null) return
  try {
    const raw = readRaw()
    const repos = { ...(raw.global.repos ?? {}) }
    repos[key] = { ...(repos[key] ?? {}), ...patch }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...raw.global, repos }))
  } catch {
    // Ignore storage failures.
  }
}







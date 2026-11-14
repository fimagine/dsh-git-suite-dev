/**
 * Persisted panel UI state, so leaving and returning to the panel keeps the
 * view mode, history filters, page size, splitters, and tree expansion.
 */

export type ViewMode = 'history' | 'workspace'
export type SortMode = 'date' | 'topo'

export interface UiState {
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
  openSections?: Record<string, boolean>
  collapsedFolders?: Record<string, boolean>
}

const STORAGE_KEY = 'dsh-git-suite:ui-state'

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function booleanRecord(value: unknown): Record<string, boolean> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const out: Record<string, boolean> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'boolean') out[key] = item
  }
  return out
}

/** Read the persisted UI state, ignoring missing or malformed fields. */
export function readUiState(): UiState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const source = parsed as Record<string, unknown>
    const state: UiState = {}
    if (source.viewMode === 'history' || source.viewMode === 'workspace') state.viewMode = source.viewMode
    const limit = finite(source.limit)
    if (limit !== undefined && limit > 0) state.limit = Math.round(limit)
    if (source.sort === 'date' || source.sort === 'topo') state.sort = source.sort
    if (typeof source.showRemotes === 'boolean') state.showRemotes = source.showRemotes
    const treeWidth = finite(source.treeWidth)
    if (treeWidth !== undefined) state.treeWidth = treeWidth
    const treeHeight = finite(source.treeHeight)
    if (treeHeight !== undefined) state.treeHeight = treeHeight
    const detailRatio = finite(source.detailRatio)
    if (detailRatio !== undefined) state.detailRatio = detailRatio
    const commitFilesWidth = finite(source.commitFilesWidth)
    if (commitFilesWidth !== undefined) state.commitFilesWidth = commitFilesWidth
    const commitStagedHeight = finite(source.commitStagedHeight)
    if (commitStagedHeight !== undefined) state.commitStagedHeight = commitStagedHeight
    const commitFormHeight = finite(source.commitFormHeight)
    if (commitFormHeight !== undefined) state.commitFormHeight = commitFormHeight
    const openSections = booleanRecord(source.openSections)
    if (openSections !== undefined) state.openSections = openSections
    const collapsedFolders = booleanRecord(source.collapsedFolders)
    if (collapsedFolders !== undefined) state.collapsedFolders = collapsedFolders
    return state
  } catch {
    return {}
  }
}

/** Merge a partial UI state update into localStorage; storage failures are ignored. */
export function writeUiState(patch: Partial<UiState>): void {
  try {
    const next = { ...readUiState(), ...patch }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // A disabled or full localStorage must not break the panel.
  }
}

import type { LocaleKey } from './locales/en.js'

export type Translate = (key: LocaleKey) => string

export interface Commit {
  hash: string
  shortHash: string
  author: string
  email: string
  date: string
  parents: string[]
  refs: string[]
  subject: string
}

export interface CommitFile {
  path: string
  additions: number | null
  deletions: number | null
  binary: boolean
}

export interface CommitDetail extends Commit {
  body: string
  files: CommitFile[]
  patch: string
  patchTruncated: boolean
}

export interface Branch {
  ref: string
  name: string
  kind: 'local' | 'remote'
  hash: string
  current: boolean
  upstream?: string
  /** Commits the branch is ahead of its upstream. */
  ahead?: number
  /** Commits the branch is behind its upstream. */
  behind?: number
  /** Upstream branch no longer exists on the remote. */
  gone?: boolean
}

export interface TagRef {
  ref: string
  name: string
  hash: string
  date: string
}

export interface StashRef {
  /** Reflog selector, e.g. `stash@{0}`. */
  ref: string
  /** Commit the stash points at. */
  hash: string
  date: string
  message: string
}

export type SyncAction = 'fetch' | 'pull' | 'push' | 'fetch-tag'

export interface FetchOptions {
  fetchAll: boolean
  prune: boolean
  tags: boolean
  forceTags: boolean
  remote?: string
}

export interface RemoteRemovePayload {
  ok: true
  action: 'remove'
  name: string
}

export interface RemoteAddPayload {
  ok: true
  action: 'add'
  name: string
  url: string
}

export interface RemoteUrlPayload {
  ok: true
  action: 'set-url'
  name: string
  url: string
}

export type BranchAction = 'merge' | 'rebase' | 'rename' | 'delete' | 'track' | 'delete-remote'

export interface BranchActionPayload {
  ok: true
  action: BranchAction
  branch: string
  remote?: string
  newName?: string
}

export interface PushTarget {
  local: string
  remote: string
  track: boolean
}

export interface PushOptions {
  remote: string
  refs: PushTarget[]
  tags: boolean
  force: boolean
}

export interface SyncPayload {
  ok: true
  action: SyncAction
  remote?: string
  branch?: string
}

export interface SubmoduleRef {
  /** Repository-relative submodule path. */
  path: string
  /** Display name: the last path segment. */
  name: string
}

export interface RemoteGroup {
  name: string
  url: string
  branches: Branch[]
}

export interface Project {
  path: string
  name: string
  workspaceId?: string
  workspaceTitle?: string
  nested?: boolean
}

export interface Repo {
  repoRoot: string
  repoName: string
  branch: string
  defaultPath: string
  /** Superproject working tree when this repository is a submodule. */
  superproject: string | null
}

/** Commit list columns that the header menu can show or hide. */
export type CommitColumn = 'graph' | 'date' | 'author' | 'hash'

export type CommitColumns = Record<CommitColumn, boolean>

/** What the commit list currently shows: HEAD, a scope, or one ref/stash. */
export type Selection =
  | { kind: 'head' }
  | { kind: 'all' }
  | { kind: 'remotes' }
  | { kind: 'branch'; ref: string; name: string; remote: boolean }
  | { kind: 'tag'; ref: string; name: string }
  | { kind: 'stash'; ref: string; hash: string }

export interface ProjectsPayload {
  ok: true
  projects: Project[]
  truncated: boolean
  defaultPath: string
}

export interface BranchesPayload {
  ok: true
  repoRoot: string
  current: string
  branches: Branch[]
}

export interface RefsPayload {
  ok: true
  repoRoot: string
  /** Checked-out branch, or `detached`. */
  current: string
  /** Local branches. */
  branches: Branch[]
  tags: TagRef[]
  remotes: RemoteGroup[]
  stashes: StashRef[]
  submodules: SubmoduleRef[]
}

export interface LogPayload {
  ok: true
  repoRoot: string
  repoName: string
  branch: string
  defaultPath: string
  superproject: string | null
  commits: Commit[]
  hasMore: boolean
  nextOffset: number
}

export interface CommitPayload {
  ok: true
  commit: CommitDetail
}

export interface SwitchPayload {
  ok: true
  repoRoot: string
  /** Branch now checked out. */
  branch: string
  /** Branch that was checked out before the switch. */
  previous: string
}

export type WorkspaceScope = 'staged' | 'unstaged' | 'untracked'

export interface WorkspaceFile {
  path: string
  status: string
  origPath?: string
  staged: boolean
  untracked: boolean
  additions: number | null
  deletions: number | null
  binary: boolean
}

export interface WorkspaceStatus {
  repoRoot: string
  branch: string
  upstream: string | null
  ahead: number
  behind: number
  author: { name: string; email: string }
  staged: WorkspaceFile[]
  unstaged: WorkspaceFile[]
}

export interface WorkspaceStatusPayload {
  ok: true
  workspace: WorkspaceStatus
}

export interface WorkspaceDiff {
  path: string
  scope: WorkspaceScope
  patch: string
  binary: boolean
  truncated: boolean
}

export interface WorkspaceDiffPayload {
  ok: true
  diff: WorkspaceDiff
}

export interface WorkspaceCommit {
  hash: string
  shortHash: string
  subject: string
  branch: string
  upstream: string | null
  pushed: boolean
}

export interface WorkspaceActionPayload {
  ok: true
  action: 'stage' | 'unstage' | 'commit'
  commit?: WorkspaceCommit
}

export interface ClonePayload {
  ok: true
  repoRoot: string
}

export interface OpenAppPayload {
  ok: true
  target: 'terminal' | 'explorer'
  path: string
}

/** Installed version versus the latest one published on npm. */
export interface VersionPayload {
  ok: true
  current: string
  latest: string
  updateAvailable: boolean
}

/** Result of a cherry-pick, revert, reset, or an abort. */
export interface CommitOpPayload {
  ok: true
  action: 'cherry-pick' | 'revert' | 'reset' | 'abort'
  mode?: 'soft' | 'mixed' | 'hard'
  hash?: string
  head?: string
  operation?: 'merge' | 'rebase' | 'cherry-pick' | 'revert'
}

/** One recent HEAD movement from `git reflog`. */
export interface ReflogEntry {
  hash: string
  shortHash: string
  selector: string
  action: string
  author: string
  date: string
}

export interface ReflogPayload {
  ok: true
  entries: ReflogEntry[]
}

export interface RevealPayload {
  ok: true
  file: string
  path: string
}

/** One ref resolved to the commit it points at. */
export interface ResolvePayload {
  ok: true
  hash: string
  shortHash: string
  author: string
  date: string
  subject: string
}

/** One tag with the commit it points at and its annotation message. */
export interface TagInfoPayload {
  ok: true
  name: string
  hash: string
  shortHash: string
  subject: string
  message: string
  annotated: boolean
  objectHash: string
}

/** How each local tag compares with one remote's tags. */
export interface TagStatusPayload {  ok: true
  remote: string
  statuses: Record<string, 'same' | 'different' | 'local-only'>
  /** Tags that exist on the remote but not locally. */
  remoteOnly: string[]
}

export interface GenerateMessagePayload {
  ok: true
  message: string
  source: 'staged' | 'unstaged'
}

export interface PickDirectoryPayload {
  ok: true
  capability: 'native' | 'browse'
  cancelled?: boolean
  path?: string
  name?: string
  hasWorkspace?: boolean
  workspaceTitle?: string
}

export interface TagPayload {
  ok: true
  tag: string
  hash: string
}

export interface BranchPayload {
  ok: true
  branch: string
  hash: string
}

export interface CheckoutPayload {
  ok: true
  branch: string | null
  hash: string
  detached: boolean
}

export type LoadStatus = 'loading' | 'ready' | 'error'
export type DetailStatus = 'idle' | LoadStatus

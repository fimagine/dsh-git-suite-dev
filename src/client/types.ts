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

export interface SubmoduleRef {
  /** Repository-relative submodule path. */
  path: string
  /** Display name: the last path segment. */
  name: string
}

export interface RemoteGroup {
  name: string
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

export interface CreateWorkspacePayload {
  ok: true
  path: string
  title: string
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

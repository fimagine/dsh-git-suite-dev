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

export interface CommitHeader extends Commit {
  body: string
}

export interface CommitDetail extends CommitHeader {
  files: CommitFile[]
  patch: string
  patchTruncated: boolean
}

export interface WorkspaceFile {
  path: string
  /** One-letter status shown in the list: A/M/D/R/C/U or `?` for untracked. */
  status: string
  /** Original path for a rename/copy. */
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

export interface WorkspaceDiff {
  path: string
  scope: 'staged' | 'unstaged' | 'untracked'
  patch: string
  binary: boolean
  truncated: boolean
}

export interface WorkspaceCommit {
  hash: string
  shortHash: string
  subject: string
  branch: string
  upstream: string | null
  pushed: boolean
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

/** Installed version versus the latest one published on npm. */
export interface VersionPayload {
  ok: true
  current: string
  latest: string
  updateAvailable: boolean
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

/** One local tag with the commit it points at and its annotation message. */
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
export interface TagStatusPayload {
  ok: true
  remote: string
  statuses: Record<string, 'same' | 'different' | 'local-only'>
  /** Tags that exist on the remote but not locally. */
  remoteOnly: string[]
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

export interface Project {
  path: string
  name: string
  workspaceId: string
  workspaceTitle: string
  nested: boolean
}

export interface WorkspaceRef {
  id: string
  title: string
  path: string
}

/** What the route needs from the host context: the workspace registry and a fallback directory. */
export interface RouteContext {
  workspaces(): WorkspaceRef[]
  defaultPath(): string
}

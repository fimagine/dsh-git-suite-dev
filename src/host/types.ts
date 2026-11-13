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

export interface Branch {
  ref: string
  name: string
  kind: 'local' | 'remote'
  hash: string
  current: boolean
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

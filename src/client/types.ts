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
}

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

export interface LogPayload {
  ok: true
  repoRoot: string
  repoName: string
  branch: string
  defaultPath: string
  commits: Commit[]
  hasMore: boolean
  nextOffset: number
}

export interface CommitPayload {
  ok: true
  commit: CommitDetail
}

export type LoadStatus = 'loading' | 'ready' | 'error'
export type DetailStatus = 'idle' | LoadStatus

import type { PullCommit, PullDetail, PullFile, PullSummary } from '../types.js'
import type { ForgeTarget } from './detect.js'
import { forgeJson } from './http.js'

interface GitLabUser {
  name?: string
  username?: string
}

interface GitLabMergeRequest {
  iid?: number
  title?: string
  state?: string
  draft?: boolean
  work_in_progress?: boolean
  author?: GitLabUser | null
  source_branch?: string
  target_branch?: string
  created_at?: string
  updated_at?: string
  web_url?: string
  description?: string | null
  has_conflicts?: boolean
  changes_count?: string
}

interface GitLabChange {
  old_path?: string
  new_path?: string
  diff?: string
  new_file?: boolean
  deleted_file?: boolean
  renamed_file?: boolean
  too_large?: boolean
}

interface GitLabChanges {
  changes?: GitLabChange[]
  overflow?: boolean
  changes_count?: string
}

interface GitLabCommit {
  id?: string
  short_id?: string
  title?: string
  author_name?: string
  created_at?: string
}

const PAGE_SIZE = 30

function projectId(target: ForgeTarget): string {
  return `/projects/${encodeURIComponent(target.projectPath)}`
}

function stateOf(pull: GitLabMergeRequest): PullSummary['state'] {
  if (pull.state === 'opened') return 'open'
  if (pull.state === 'merged') return 'merged'
  return 'closed'
}

function statusOf(change: GitLabChange): string {
  if (change.new_file === true) return 'added'
  if (change.deleted_file === true) return 'deleted'
  if (change.renamed_file === true) return 'renamed'
  return 'modified'
}

/** Count changed lines in one GitLab diff, ignoring the file headers. */
function lineCounts(diff: string): { additions: number; deletions: number } {
  let additions = 0
  let deletions = 0
  for (const line of diff.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions += 1
    else if (line.startsWith('-') && !line.startsWith('---')) deletions += 1
  }
  return { additions, deletions }
}

function summary(pull: GitLabMergeRequest): PullSummary {
  return {
    number: typeof pull.iid === 'number' ? pull.iid : 0,
    title: typeof pull.title === 'string' ? pull.title : '',
    state: stateOf(pull),
    draft: pull.draft === true || pull.work_in_progress === true,
    author: pull.author?.name ?? pull.author?.username ?? '',
    sourceBranch: typeof pull.source_branch === 'string' ? pull.source_branch : '',
    targetBranch: typeof pull.target_branch === 'string' ? pull.target_branch : '',
    createdAt: typeof pull.created_at === 'string' ? pull.created_at : '',
    updatedAt: typeof pull.updated_at === 'string' ? pull.updated_at : '',
    webUrl: typeof pull.web_url === 'string' ? pull.web_url : '',
  }
}

function fileOf(change: GitLabChange): PullFile {
  const diff = typeof change.diff === 'string' ? change.diff : ''
  const counts = lineCounts(diff)
  return {
    path: change.new_path ?? change.old_path ?? '',
    status: statusOf(change),
    additions: counts.additions,
    deletions: counts.deletions,
    patch: diff,
    binary: change.too_large === true,
  }
}

function commitOf(commit: GitLabCommit): PullCommit {
  const hash = typeof commit.id === 'string' ? commit.id : ''
  return {
    hash,
    shortHash: commit.short_id ?? hash.slice(0, 7),
    subject: typeof commit.title === 'string' ? commit.title : '',
    author: typeof commit.author_name === 'string' ? commit.author_name : '',
    date: typeof commit.created_at === 'string' ? commit.created_at : '',
  }
}

function changedFiles(pull: GitLabMergeRequest, fallback: number): number {
  const raw = pull.changes_count
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number.parseInt(raw, 10)
  return fallback
}

export async function listGitlabPulls(
  target: ForgeTarget,
  token: string | null,
  state: 'open' | 'all',
  signal?: AbortSignal,
  fresh = false,
): Promise<PullSummary[]> {
  const query = state === 'all' ? 'state=all' : 'state=opened'
  const pulls = await forgeJson<GitLabMergeRequest[]>(
    target,
    `${projectId(target)}/merge_requests?${query}&order_by=updated_at&sort=desc&per_page=${PAGE_SIZE}`,
    token,
    signal,
    { fresh },
  )
  return Array.isArray(pulls) ? pulls.map(summary) : []
}

export async function getGitlabPull(
  target: ForgeTarget,
  number: number,
  token: string | null,
  signal?: AbortSignal,
  fresh = false,
): Promise<PullDetail> {
  const base = `${projectId(target)}/merge_requests/${number}`
  const [pull, changes, commits] = await Promise.all([
    forgeJson<GitLabMergeRequest>(target, base, token, signal, { fresh }),
    forgeJson<GitLabChanges>(target, `${base}/changes`, token, signal, { fresh }).catch(() => ({} as GitLabChanges)),
    forgeJson<GitLabCommit[]>(target, `${base}/commits?per_page=100`, token, signal, { fresh }).catch(() => [] as GitLabCommit[]),
  ])
  const fileList = (Array.isArray(changes.changes) ? changes.changes : []).map(fileOf)
  const commitList = (Array.isArray(commits) ? commits : []).map(commitOf)
  const additions = fileList.reduce((total, file) => total + (file.additions ?? 0), 0)
  const deletions = fileList.reduce((total, file) => total + (file.deletions ?? 0), 0)
  const countText = changes.changes_count ?? pull.changes_count
  return {
    ...summary(pull),
    body: typeof pull.description === 'string' ? pull.description : '',
    additions,
    deletions,
    changedFiles: changedFiles(pull, fileList.length),
    mergeable: pull.has_conflicts === true ? false : pull.has_conflicts === false ? true : null,
    headRepoUrl: null,
    files: fileList,
    commits: commitList,
    filesTruncated: changes.overflow === true || (typeof countText === 'string' && countText.endsWith('+')),
  }
}

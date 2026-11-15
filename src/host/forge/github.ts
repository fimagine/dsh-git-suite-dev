import type { PullCommit, PullDetail, PullFile, PullSummary } from '../types.js'
import type { ForgeTarget } from './detect.js'
import { forgeJson } from './http.js'

interface GitHubUser {
  login?: string
}

interface GitHubRepository {
  clone_url?: string
}

interface GitHubPull {
  number?: number
  title?: string
  state?: string
  draft?: boolean
  merged_at?: string | null
  user?: GitHubUser | null
  head?: { ref?: string; repo?: GitHubRepository | null } | null
  base?: { ref?: string } | null
  created_at?: string
  updated_at?: string
  html_url?: string
  body?: string | null
  additions?: number
  deletions?: number
  changed_files?: number
  mergeable?: boolean | null
}

interface GitHubFile {
  filename?: string
  previous_filename?: string
  status?: string
  additions?: number
  deletions?: number
  patch?: string
}

interface GitHubCommit {
  sha?: string
  commit?: {
    message?: string
    author?: { name?: string; date?: string } | null
  }
  author?: GitHubUser | null
}

const PAGE_SIZE = 30

function repoPath(target: ForgeTarget): string {
  return `/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}`
}

function stateOf(pull: GitHubPull): PullSummary['state'] {
  if (pull.state === 'open') return 'open'
  return typeof pull.merged_at === 'string' && pull.merged_at !== '' ? 'merged' : 'closed'
}

function fileStatus(status: string | undefined): string {
  if (status === 'removed') return 'deleted'
  if (status === 'added' || status === 'renamed' || status === 'copied') return status
  return 'modified'
}

function summary(pull: GitHubPull): PullSummary {
  return {
    number: typeof pull.number === 'number' ? pull.number : 0,
    title: typeof pull.title === 'string' ? pull.title : '',
    state: stateOf(pull),
    draft: pull.draft === true,
    author: typeof pull.user?.login === 'string' ? pull.user.login : '',
    sourceBranch: typeof pull.head?.ref === 'string' ? pull.head.ref : '',
    targetBranch: typeof pull.base?.ref === 'string' ? pull.base.ref : '',
    createdAt: typeof pull.created_at === 'string' ? pull.created_at : '',
    updatedAt: typeof pull.updated_at === 'string' ? pull.updated_at : '',
    webUrl: typeof pull.html_url === 'string' ? pull.html_url : '',
  }
}

function fileOf(file: GitHubFile): PullFile {
  return {
    path: file.filename ?? file.previous_filename ?? '',
    status: fileStatus(file.status),
    additions: typeof file.additions === 'number' ? file.additions : null,
    deletions: typeof file.deletions === 'number' ? file.deletions : null,
    patch: typeof file.patch === 'string' ? file.patch : '',
    binary: false,
  }
}

function commitOf(commit: GitHubCommit): PullCommit {
  const hash = typeof commit.sha === 'string' ? commit.sha : ''
  const message = typeof commit.commit?.message === 'string' ? commit.commit.message : ''
  return {
    hash,
    shortHash: hash.slice(0, 7),
    subject: message.split('\n')[0] ?? '',
    author: commit.commit?.author?.name ?? commit.author?.login ?? '',
    date: typeof commit.commit?.author?.date === 'string' ? commit.commit.author.date : '',
  }
}

export async function listGithubPulls(
  target: ForgeTarget,
  token: string | null,
  state: 'open' | 'all',
  signal?: AbortSignal,
  fresh = false,
): Promise<PullSummary[]> {
  const query = state === 'all' ? 'state=all' : 'state=open'
  const pulls = await forgeJson<GitHubPull[]>(
    target,
    `${repoPath(target)}/pulls?${query}&sort=updated&direction=desc&per_page=${PAGE_SIZE}`,
    token,
    signal,
    { fresh },
  )
  return Array.isArray(pulls) ? pulls.map(summary) : []
}

export async function getGithubPull(
  target: ForgeTarget,
  number: number,
  token: string | null,
  signal?: AbortSignal,
  fresh = false,
): Promise<PullDetail> {
  const base = `${repoPath(target)}/pulls/${number}`
  const [pull, files, commits] = await Promise.all([
    forgeJson<GitHubPull>(target, base, token, signal, { fresh }),
    forgeJson<GitHubFile[]>(target, `${base}/files?per_page=100`, token, signal, { fresh }).catch(() => [] as GitHubFile[]),
    forgeJson<GitHubCommit[]>(target, `${base}/commits?per_page=100`, token, signal, { fresh }).catch(() => [] as GitHubCommit[]),
  ])
  const fileList = Array.isArray(files) ? files.map(fileOf) : []
  const commitList = Array.isArray(commits) ? commits.map(commitOf) : []
  return {
    ...summary(pull),
    body: typeof pull.body === 'string' ? pull.body : '',
    additions: typeof pull.additions === 'number' ? pull.additions : null,
    deletions: typeof pull.deletions === 'number' ? pull.deletions : null,
    changedFiles: typeof pull.changed_files === 'number' ? pull.changed_files : fileList.length,
    mergeable: typeof pull.mergeable === 'boolean' ? pull.mergeable : null,
    headRepoUrl: typeof pull.head?.repo?.clone_url === 'string' ? pull.head.repo.clone_url : null,
    files: fileList,
    commits: commitList,
    filesTruncated: fileList.length >= 100 || (typeof pull.changed_files === 'number' && pull.changed_files > fileList.length),
  }
}

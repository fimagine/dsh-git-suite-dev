import { lstat, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import type { ForgeTarget } from './forge/detect.js'
import { forgeJson } from './forge/http.js'
import { runGit } from './git.js'
import type { PullDetail } from './types.js'

export interface ReviewContextFile {
  path: string
  content: string
}

export interface ReviewContext {
  mode: 'worktree' | 'api' | 'diff'
  files: ReviewContextFile[]
  truncated: boolean
}

const MAX_CONTEXT_FILES = 40
const MAX_FILE_CHARS = 120_000
const MAX_TOTAL_CHARS = 80_000
const MAX_API_FILES = 12

export interface ReviewContextLimits {
  maxFiles?: number
  maxFileChars?: number
  maxTotalChars?: number
  maxApiFiles?: number
}

function repoFromUrl(url: string | null): { owner: string; repo: string } | null {
  if (url === null) return null
  try {
    const path = new URL(url).pathname.replace(/^\/+/, '').replace(/\.git$/i, '')
    const slash = path.indexOf('/')
    if (slash <= 0 || slash === path.length - 1) return null
    return { owner: path.slice(0, slash), repo: path.slice(slash + 1) }
  } catch {
    return null
  }
}

function safeContent(raw: string): string {
  return raw.includes('\u0000') ? '' : raw
}

async function readWorktreeFiles(
  root: string,
  pull: PullDetail,
  limits: ReviewContextLimits,
): Promise<{ files: ReviewContextFile[]; truncated: boolean }> {
  const base = resolve(root)
  const prefix = base.endsWith(sep) ? base : `${base}${sep}`
  const maxFiles = limits.maxFiles ?? MAX_CONTEXT_FILES
  const maxFileChars = limits.maxFileChars ?? MAX_FILE_CHARS
  const maxTotalChars = limits.maxTotalChars ?? MAX_TOTAL_CHARS
  const files: ReviewContextFile[] = []
  let total = 0
  let truncated = false
  for (const file of pull.files.slice(0, maxFiles)) {
    if (file.status === 'deleted') continue
    const absolute = resolve(base, file.path)
    if (!absolute.startsWith(prefix)) continue
    try {
      const info = await lstat(absolute)
      if (!info.isFile() || info.size > maxFileChars) {
        truncated = true
        continue
      }
      const content = safeContent(await readFile(absolute, 'utf8'))
      if (content === '') continue
      const room = maxTotalChars - total
      if (room <= 0) {
        truncated = true
        break
      }
      const clipped = content.slice(0, Math.min(maxFileChars, room))
      files.push({ path: file.path, content: clipped })
      total += clipped.length
      if (clipped.length < content.length) truncated = true
    } catch {
      // Deleted or unreadable at the head: the patch still covers it.
    }
  }
  return { files, truncated }
}

async function readApiFiles(
  target: ForgeTarget,
  token: string | null,
  pull: PullDetail,
  signal: AbortSignal,
  limits: ReviewContextLimits,
): Promise<{ files: ReviewContextFile[]; truncated: boolean }> {
  const maxFileChars = limits.maxFileChars ?? MAX_FILE_CHARS
  const maxTotalChars = limits.maxTotalChars ?? MAX_TOTAL_CHARS
  const maxApiFiles = limits.maxApiFiles ?? MAX_API_FILES
  const head = repoFromUrl(pull.headRepoUrl) ?? { owner: target.owner, repo: target.repo }
  const headTarget: ForgeTarget = {
    ...target,
    owner: head.owner,
    repo: head.repo,
    projectPath: `${head.owner}/${head.repo}`,
    webUrl: pull.headRepoUrl ?? target.webUrl,
  }
  const encodedPath = (path: string): string => path.split('/').map(encodeURIComponent).join('/')
  const files: ReviewContextFile[] = []
  let total = 0
  let truncated = false
  for (const file of pull.files.slice(0, maxApiFiles)) {
    if (file.status === 'deleted') continue
    const room = maxTotalChars - total
    if (room <= 0) {
      truncated = true
      break
    }
    let raw = ''
    try {
      if (target.provider === 'gitlab') {
        const response = await forgeJson<{ content?: string; encoding?: string }>(
          headTarget,
          `/projects/${encodeURIComponent(headTarget.projectPath)}/repository/files/${encodeURIComponent(file.path)}?ref=${encodeURIComponent(pull.sourceBranch)}`,
          token,
          signal,
          { fresh: true },
        )
        raw = typeof response.content === 'string' ? Buffer.from(response.content, 'base64').toString('utf8') : ''
      } else {
        const response = await forgeJson<{ content?: string; encoding?: string } | Array<unknown>>(
          headTarget,
          `/repos/${encodeURIComponent(headTarget.owner)}/${encodeURIComponent(headTarget.repo)}/contents/${encodedPath(file.path)}?ref=${encodeURIComponent(pull.sourceBranch)}`,
          token,
          signal,
          { fresh: true },
        )
        raw = !Array.isArray(response) && typeof response.content === 'string'
          ? response.encoding === 'base64'
            ? Buffer.from(response.content.replace(/\s/g, ''), 'base64').toString('utf8')
            : response.content
          : ''
      }
    } catch {
      continue
    }
    const content = safeContent(raw)
    if (content === '') continue
    const clipped = content.slice(0, Math.min(maxFileChars, room))
    files.push({ path: file.path, content: clipped })
    total += clipped.length
    if (clipped.length < content.length) truncated = true
  }
  return { files, truncated }
}

export type ReviewContextMode = 'auto' | 'diff' | 'api' | 'worktree'

/**
 * Read full contents of the changed files at the PR head according to the
 * caller's mode. `worktree` creates a detached temporary checkout (removed
 * immediately), `api` reads through the forge, and `auto` tries worktree first
 * and then the API. Files are never executed.
 */
export async function readReviewContext(
  root: string,
  remote: string,
  target: ForgeTarget,
  pull: PullDetail,
  number: number,
  token: string | null,
  signal: AbortSignal,
  mode: ReviewContextMode = 'auto',
  limits: ReviewContextLimits = {},
): Promise<ReviewContext> {
  if (mode === 'diff') return { mode: 'diff', files: [], truncated: false }

  if (mode === 'auto' || mode === 'worktree') {
    const localRef = `refs/dsh-pr-review/${number}`
    const prRef = target.provider === 'gitlab' ? `refs/merge-requests/${number}/head` : `refs/pull/${number}/head`
    let dir = ''
    try {
      try {
        await runGit(root, ['fetch', '--no-tags', remote, `+${prRef}:${localRef}`], signal)
      } catch {
        if (pull.headRepoUrl === null) throw new Error('no pull ref')
        await runGit(
          root,
          ['fetch', '--no-tags', pull.headRepoUrl, `+refs/heads/${pull.sourceBranch}:${localRef}`],
          signal,
        )
      }
      const commit = (await runGit(root, ['rev-parse', localRef], signal)).trim()
      dir = await mkdtemp(join(tmpdir(), 'dsh-pr-review-'))
      await runGit(root, ['worktree', 'add', '--detach', dir, commit], signal)
      const files = await readWorktreeFiles(dir, pull, limits)
      if (files.files.length > 0) {
        return { mode: 'worktree', files: files.files, truncated: files.truncated }
      }
    } catch {
      // Fall through to the API when auto; otherwise report diff-only.
    } finally {
      if (dir !== '') {
        await runGit(root, ['worktree', 'remove', '--force', dir]).catch(() => '')
        await rm(dir, { recursive: true, force: true }).catch(() => '')
      }
      await runGit(root, ['update-ref', '-d', localRef]).catch(() => '')
    }
  }

  if (mode === 'auto' || mode === 'api') {
    try {
      const files = await readApiFiles(target, token, pull, signal, limits)
      return { mode: files.files.length > 0 ? 'api' : 'diff', files: files.files, truncated: files.truncated }
    } catch {
      // Fall through to diff-only.
    }
  }
  return { mode: 'diff', files: [], truncated: false }
}

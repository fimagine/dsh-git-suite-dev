import { RouteError } from './errors.js'
import type { Commit, CommitFile, CommitHeader } from './types.js'

const FIELD_SEPARATOR = '\x1f'
const HASH = /^[0-9a-f]{7,64}$/i

function splitParents(raw: string): string[] {
  return raw === '' ? [] : raw.split(' ').filter(Boolean)
}

function splitRefs(raw: string): string[] {
  return raw === '' ? [] : raw.split(',').map(value => value.trim()).filter(Boolean)
}

/** Parse the NUL-separated `git log` stream produced by the viewer's format string. */
export function parseLog(output: string): Commit[] {
  const commits: Commit[] = []
  for (const raw of output.split('\0')) {
    const record = raw.replace(/^\r?\n+/, '')
    if (record === '') continue
    const fields = record.split(FIELD_SEPARATOR)
    if (fields.length < 8) continue
    const [hash = '', shortHash = '', author = '', email = '', date = '', parents = '', refs = '', ...subjectParts] = fields
    if (!HASH.test(hash)) continue
    commits.push({
      hash,
      shortHash,
      author,
      email,
      date,
      parents: splitParents(parents),
      refs: splitRefs(refs),
      subject: subjectParts.join(FIELD_SEPARATOR) || '(no subject)',
    })
  }
  return commits
}

/** Parse the single `git show -s` header, including the commit message body. */
export function parseCommitHeader(output: string): CommitHeader {
  const fields = output.split(FIELD_SEPARATOR)
  if (fields.length < 8) {
    throw new RouteError(500, 'git-failed', 'Git returned an unexpected commit header.')
  }
  const [hash = '', shortHash = '', author = '', email = '', date = '', parents = '', refs = '', subject = '', ...bodyParts] = fields
  return {
    hash,
    shortHash,
    author,
    email,
    date,
    parents: splitParents(parents),
    refs: splitRefs(refs),
    subject: subject || '(no subject)',
    body: bodyParts.join(FIELD_SEPARATOR).trim(),
  }
}

/** Parse `git show --numstat` output, keeping binary entries distinguishable from zero changes. */
export function parseNumstat(output: string): CommitFile[] {
  const files: CommitFile[] = []
  for (const line of output.split(/\r?\n/)) {
    if (line.trim() === '') continue
    const fields = line.split('\t')
    if (fields.length < 3) continue
    const [added = '', deleted = '', ...pathParts] = fields
    const path = pathParts.join('\t')
    if (path === '') continue
    const binary = added === '-' || deleted === '-'
    files.push({
      path,
      additions: binary ? null : Number(added),
      deletions: binary ? null : Number(deleted),
      binary,
    })
  }
  return files
}

export interface WorkspaceStatusEntry {
  path: string
  origPath: string | null
  /** Index (staged) status letter, `.` when unchanged. */
  index: string
  /** Worktree (unstaged) status letter, `.` when unchanged. */
  worktree: string
  untracked: boolean
  unmerged: boolean
}

export interface ParsedWorkspaceStatus {
  branch: string
  upstream: string | null
  ahead: number
  behind: number
  entries: WorkspaceStatusEntry[]
}

/** Parse `git status --porcelain=v2 -z --branch` into branch info and changed paths. */
export function parseWorkspaceStatus(output: string): ParsedWorkspaceStatus {
  let branch = ''
  let upstream: string | null = null
  let ahead = 0
  let behind = 0
  const entries: WorkspaceStatusEntry[] = []
  const tokens = output.split('\0')

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token === undefined || token === '') continue
    if (token.startsWith('# ')) {
      const line = token.slice(2)
      if (line.startsWith('branch.head ')) branch = line.slice('branch.head '.length)
      else if (line.startsWith('branch.upstream ')) upstream = line.slice('branch.upstream '.length)
      else if (line.startsWith('branch.ab ')) {
        const match = /^\+(\d+) -(\d+)$/.exec(line.slice('branch.ab '.length))
        if (match !== null) {
          ahead = Number(match[1])
          behind = Number(match[2])
        }
      }
      continue
    }
    if (token.startsWith('1 ')) {
      const parts = token.split(' ', 9)
      const path = parts[8] ?? ''
      if (path === '') continue
      const xy = parts[1] ?? '..'
      entries.push({ path, origPath: null, index: xy[0] ?? '.', worktree: xy[1] ?? '.', untracked: false, unmerged: false })
    } else if (token.startsWith('2 ')) {
      const parts = token.split(' ', 10)
      const path = parts[9] ?? ''
      const origPath = tokens[index + 1] ?? null
      index += 1
      if (path === '') continue
      const xy = parts[1] ?? '..'
      entries.push({ path, origPath, index: xy[0] ?? '.', worktree: xy[1] ?? '.', untracked: false, unmerged: false })
    } else if (token.startsWith('u ')) {
      const parts = token.split(' ', 11)
      const path = parts[10] ?? ''
      if (path === '') continue
      const xy = parts[1] ?? 'UU'
      entries.push({ path, origPath: null, index: xy[0] ?? 'U', worktree: xy[1] ?? 'U', untracked: false, unmerged: true })
    } else if (token.startsWith('? ')) {
      const path = token.slice(2)
      if (path === '') continue
      entries.push({ path, origPath: null, index: '?', worktree: '?', untracked: true, unmerged: false })
    }
  }

  return { branch, upstream, ahead, behind, entries }
}

/** `all` means the whole history; a missing or invalid value falls back to the page default. */export function parseLimit(raw: string | null, fallback: number): number {
  const value = (raw ?? '').trim().toLowerCase()
  if (value === 'all') return 0
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

export function parseOffset(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/** Accept only plain refs under the given prefixes, so a query parameter cannot smuggle options or rev expressions. */
function isSafeRef(value: unknown, prefixes: readonly string[]): boolean {
  if (typeof value !== 'string') return false
  if (!prefixes.some(prefix => value.startsWith(prefix))) return false
  if (value.length > 1024 || value.includes('..') || value.includes('@{')) return false
  const forbidden = new Set(['~', '^', ':', '?', '*', '[', '\\'])
  for (const character of value) {
    const code = character.codePointAt(0)
    if (code === undefined || code < 0x20 || code === 0x7f || character.trim() === '' || forbidden.has(character)) return false
  }
  return true
}

export function isBranchRef(value: unknown): value is string {
  return isSafeRef(value, ['refs/heads/', 'refs/remotes/'])
}

export function isLocalBranchRef(value: unknown): value is string {
  return isSafeRef(value, ['refs/heads/'])
}

export function isTagRef(value: unknown): value is string {
  return isSafeRef(value, ['refs/tags/'])
}

export function isCommitHash(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{4,64}$/i.test(value)
}

/** Refs a log request may name: branches, tags, or a bare commit hash. */
export function isLogRef(value: unknown): value is string {
  return isBranchRef(value) || isTagRef(value) || isCommitHash(value)
}

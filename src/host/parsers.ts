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

/** `all` means the whole history; a missing or invalid value falls back to the page default. */
export function parseLimit(raw: string | null, fallback: number): number {
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

/** Accept only plain branch refs, so a query parameter cannot smuggle git options or rev expressions. */
export function isBranchRef(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (!value.startsWith('refs/heads/') && !value.startsWith('refs/remotes/')) return false
  if (value.length > 1024 || value.includes('..') || value.includes('@{')) return false
  const forbidden = new Set(['~', '^', ':', '?', '*', '[', '\\'])
  for (const character of value) {
    const code = character.codePointAt(0)
    if (code === undefined || code < 0x20 || code === 0x7f || character.trim() === '' || forbidden.has(character)) return false
  }
  return true
}

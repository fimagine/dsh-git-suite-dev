import { access } from 'node:fs/promises'
import { runGit } from '../git.js'
import { resolveRepository } from '../repository.js'
import type { ConflictFile, OperationPayload, RouteContext } from '../types.js'

type Operation = NonNullable<OperationPayload['operation']>

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** Which merge/rebase/cherry-pick/revert currently holds the repository. */
export async function detectOperation(root: string, signal: AbortSignal): Promise<Operation | null> {
  const gitDir = (await runGit(root, ['rev-parse', '--absolute-git-dir'], signal)).trim()
  if (await exists(`${gitDir}/rebase-merge`)) return 'rebase'
  if (await exists(`${gitDir}/rebase-apply`)) return 'rebase'
  if (await exists(`${gitDir}/MERGE_HEAD`)) return 'merge'
  if (await exists(`${gitDir}/CHERRY_PICK_HEAD`)) return 'cherry-pick'
  if (await exists(`${gitDir}/REVERT_HEAD`)) return 'revert'
  return null
}

/** Unmerged paths with the stages git still keeps for them. */
function parseUnmerged(output: string): ConflictFile[] {
  const files = new Map<string, ConflictFile>()
  for (const record of output.split('\u0000')) {
    if (record === '') continue
    const tab = record.indexOf('\t')
    if (tab < 0) continue
    const parts = record.slice(0, tab).split(' ')
    const stage = Number.parseInt(parts[2] ?? '', 10)
    const path = record.slice(tab + 1)
    const entry = files.get(path) ?? { path, ours: false, theirs: false }
    if (stage === 2) entry.ours = true
    if (stage === 3) entry.theirs = true
    files.set(path, entry)
  }
  return [...files.values()]
}

/** `mode=operation`: in-progress operation plus its remaining conflict files. */
export async function readOperation(
  context: RouteContext,
  url: URL,
  signal: AbortSignal,
): Promise<OperationPayload> {
  const repo = await resolveRepository(context, url.searchParams.get('path') ?? '', signal)
  const operation = await detectOperation(repo.root, signal)
  if (operation === null) return { ok: true, operation: null, conflicts: [] }
  const unmerged = await runGit(repo.root, ['ls-files', '-u', '-z'], signal)
  return { ok: true, operation, conflicts: parseUnmerged(unmerged) }
}

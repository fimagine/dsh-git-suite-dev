import { RouteError } from '../errors.js'
import { gitFailure, runGit } from '../git.js'
import { parseCommitHeader, parseNumstat } from '../parsers.js'
import { resolveRepository } from '../repository.js'
import type { CommitDetail, RouteContext } from '../types.js'

const MAX_PATCH_CHARS = 400_000
const HASH = /^[0-9a-f]{4,64}$/

export interface CommitPayload {
  ok: true
  commit: CommitDetail
}

/** Read one commit's header, changed files, and patch. */
export async function readCommit(context: RouteContext, url: URL, signal: AbortSignal): Promise<CommitPayload> {
  const repo = await resolveRepository(context, url.searchParams.get('path'), signal)
  const hash = (url.searchParams.get('hash') ?? '').trim().toLowerCase()
  if (!HASH.test(hash)) {
    throw new RouteError(400, 'invalid-commit', 'A commit hash is required.', { path: repo.root })
  }

  try {
    const [headerOutput, numstatOutput, patchOutput] = await Promise.all([
      runGit(repo.root, [
        'show',
        '-s',
        '--encoding=UTF-8',
        '--date=iso-strict',
        '--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%P%x1f%D%x1f%s%x1f%b',
        hash,
      ], signal),
      runGit(repo.root, [
        'show',
        '--no-color',
        '--no-ext-diff',
        '--format=',
        '--numstat',
        '--find-renames',
        hash,
      ], signal),
      runGit(repo.root, [
        'show',
        '--no-color',
        '--no-ext-diff',
        '--format=',
        '--patch',
        '--find-renames',
        '--unified=3',
        hash,
      ], signal),
    ])

    const commit = parseCommitHeader(headerOutput)
    const files = parseNumstat(numstatOutput)
    const patchTruncated = patchOutput.length > MAX_PATCH_CHARS
    return {
      ok: true,
      commit: {
        ...commit,
        files,
        patch: patchTruncated ? patchOutput.slice(0, MAX_PATCH_CHARS) : patchOutput,
        patchTruncated,
      },
    }
  } catch (error) {
    throw gitFailure(error).withDetails({ path: repo.root, hash })
  }
}

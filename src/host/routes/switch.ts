import { RouteError } from '../errors.js'
import { runGit, type GitExecError } from '../git.js'
import { isLocalBranchRef } from '../parsers.js'
import { resolveRepository } from '../repository.js'
import type { RouteContext } from '../types.js'

export interface SwitchPayload {
  ok: true
  repoRoot: string
  /** Branch now checked out. */
  branch: string
  /** Branch that was checked out before the switch. */
  previous: string
}

/** Map a failed `git switch` onto the route's user-facing vocabulary. */
function switchFailure(error: unknown): RouteError {
  const failed = (error ?? {}) as GitExecError
  const detail = String(failed.stderr ?? '').trim().slice(0, 1200) || String(failed.message ?? 'git switch failed')

  if (/local changes|would be overwritten|please commit|please stash|your local changes/i.test(detail)) {
    return new RouteError(
      409,
      'worktree-dirty',
      'The working tree has changes that would be overwritten by switching branches.',
      { detail },
    )
  }
  if (/not a git repository/i.test(detail)) {
    return new RouteError(400, 'not-a-repo', 'This directory is not inside a Git repository.', { detail })
  }
  if (/did not match|not found|invalid reference|unknown branch/i.test(detail)) {
    return new RouteError(400, 'ref-not-found', 'That branch could not be resolved in this repository.', { detail })
  }
  return new RouteError(409, 'switch-failed', 'Git could not switch branches.', { detail })
}

/**
 * Switch the working tree to one local branch. Never forces: a dirty tree or a
 * conflicting branch fails and leaves the repository as it was.
 */
export async function switchBranch(context: RouteContext, url: URL, signal: AbortSignal): Promise<SwitchPayload> {
  const repo = await resolveRepository(context, url.searchParams.get('path'), signal)
  const ref = (url.searchParams.get('ref') ?? '').trim()
  if (!isLocalBranchRef(ref)) {
    throw new RouteError(400, 'invalid-ref', 'Only a local branch can be switched to.', { path: repo.root })
  }

  const branch = ref.slice('refs/heads/'.length)
  if (branch === '' || branch.startsWith('-')) {
    throw new RouteError(400, 'invalid-ref', 'That branch name is not valid.', { path: repo.root })
  }

  const previousOutput = await runGit(repo.root, ['branch', '--show-current'], signal)
  const previous = previousOutput.trim()
  try {
    await runGit(repo.root, ['switch', branch], signal)
  } catch (error) {
    throw switchFailure(error)
  }

  return {
    ok: true,
    repoRoot: repo.root,
    branch,
    previous: previous === '' ? 'detached' : previous,
  }
}

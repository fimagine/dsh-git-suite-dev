import { basename } from 'node:path'
import { RouteError } from '../errors.js'
import { gitFailure, runGit } from '../git.js'
import { isBranchRef, parseLimit, parseLog, parseOffset } from '../parsers.js'
import { resolveRepository } from '../repository.js'
import type { Commit, RouteContext } from '../types.js'

const DEFAULT_LIMIT = 50

export type LogScope = 'head' | 'all' | 'remotes' | 'ref'

export interface LogPayload {
  ok: true
  repoRoot: string
  repoName: string
  branch: string
  scope: LogScope
  ref: string | null
  limit: number
  offset: number
  hasMore: boolean
  nextOffset: number
  defaultPath: string
  commits: Commit[]
}

/** Read one page of commits for the selected refs. */
export async function readLog(context: RouteContext, url: URL, signal: AbortSignal): Promise<LogPayload> {
  const repo = await resolveRepository(context, url.searchParams.get('path'), signal)
  const limit = parseLimit(url.searchParams.get('limit'), DEFAULT_LIMIT)
  const offset = parseOffset(url.searchParams.get('offset'))
  const scope = url.searchParams.get('scope') ?? ''
  const ref = (url.searchParams.get('ref') ?? '').trim()
  const limitArgs = limit > 0 ? ['-n', String(limit + 1)] : []
  const offsetArgs = offset > 0 ? [`--skip=${offset}`] : []
  let refArgs: string[] = []

  if (scope === 'all') {
    refArgs = ['--branches', '--remotes']
  } else if (scope === 'remotes') {
    refArgs = ['--remotes']
  } else if (ref !== '') {
    if (!isBranchRef(ref)) {
      throw new RouteError(400, 'invalid-ref', 'That branch reference is not valid.', { path: repo.root })
    }
    try {
      await runGit(repo.root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], signal)
    } catch {
      throw new RouteError(400, 'branch-not-found', 'That branch could not be resolved in this repository.', {
        path: repo.root,
        ref,
      })
    }
    refArgs = [ref]
  }

  try {
    const [branchOutput, logOutput] = await Promise.all([
      runGit(repo.root, ['branch', '--show-current'], signal),
      runGit(repo.root, [
        'log',
        '--topo-order',
        '--date=iso-strict',
        '--encoding=UTF-8',
        '--decorate=short',
        '-z',
        '--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%P%x1f%D%x1f%s',
        ...offsetArgs,
        ...limitArgs,
        ...refArgs,
      ], signal),
    ])

    const branch = branchOutput.trim() === '' ? 'detached' : branchOutput.trim()
    const commits = parseLog(logOutput)
    const hasMore = limit > 0 && commits.length > limit
    const page = hasMore ? commits.slice(0, limit) : commits
    return {
      ok: true,
      repoRoot: repo.root,
      repoName: basename(repo.root) || repo.root,
      branch,
      scope: scope === 'all' || scope === 'remotes' ? scope : ref === '' ? 'head' : 'ref',
      ref: ref === '' ? null : ref,
      limit,
      offset,
      hasMore,
      nextOffset: offset + page.length,
      defaultPath: context.defaultPath(),
      commits: page,
    }
  } catch (error) {
    throw gitFailure(error).withDetails({ path: repo.root })
  }
}

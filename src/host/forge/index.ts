import type { PullDetail, PullSummary } from '../types.js'
import type { ForgeTarget } from './detect.js'
import { getGiteePull, listGiteePulls } from './gitee.js'
import { getGithubPull, listGithubPulls } from './github.js'
import { getGitlabPull, listGitlabPulls } from './gitlab.js'
import { forgeJson } from './http.js'

/** One page of pull requests; the list route reports whether more may exist. */
export const PULL_PAGE_SIZE = 30

/** Read one page of pull requests from the forge that owns this remote. */
export function listPulls(
  target: ForgeTarget,
  token: string | null,
  state: 'open' | 'all',
  signal?: AbortSignal,
  fresh = false,
): Promise<PullSummary[]> {
  if (target.provider === 'github') return listGithubPulls(target, token, state, signal, fresh)
  if (target.provider === 'gitee') return listGiteePulls(target, token, state, signal, fresh)
  return listGitlabPulls(target, token, state, signal, fresh)
}

/** Read one pull request with its files and commits. */
export function getPull(
  target: ForgeTarget,
  number: number,
  token: string | null,
  signal?: AbortSignal,
  fresh = false,
): Promise<PullDetail> {
  if (target.provider === 'github') return getGithubPull(target, number, token, signal, fresh)
  if (target.provider === 'gitee') return getGiteePull(target, number, token, signal, fresh)
  return getGitlabPull(target, number, token, signal, fresh)
}

/**
 * The account a token belongs to, used as the git credential username. Gitee's
 * git HTTPS transport requires the real account name (not a placeholder), so
 * storing it correctly is what makes later fetches and pushes work.
 */
export async function readForgeLogin(
  target: ForgeTarget,
  token: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const user = await forgeJson<{ login?: unknown; username?: unknown }>(
      target,
      '/user',
      token,
      signal,
      { fresh: true },
    )
    if (typeof user.login === 'string' && user.login.trim() !== '') return user.login.trim()
    if (typeof user.username === 'string' && user.username.trim() !== '') return user.username.trim()
  } catch {
    // A token without the user scope still saves; the caller falls back.
  }
  return null
}

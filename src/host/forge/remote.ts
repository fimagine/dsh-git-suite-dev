import { RouteError } from '../errors.js'
import { gitFailure, runGit } from '../git.js'

export interface ResolvedRemote {
  name: string
  url: string
}

/** Names configured in this repository, in git's own order. */
export async function listRemoteNames(root: string, signal?: AbortSignal): Promise<string[]> {
  try {
    return (await runGit(root, ['remote'], signal))
      .split(/\r?\n/)
      .map(name => name.trim())
      .filter(name => name !== '')
  } catch (error) {
    throw gitFailure(error)
  }
}

/**
 * Resolve the remote a pull-request view works on. An explicit name wins; when
 * it is empty, the current branch's upstream remote is used, then `origin`,
 * then the first configured remote.
 */
export async function resolveRemote(
  root: string,
  requested: string,
  signal?: AbortSignal,
): Promise<ResolvedRemote> {
  const names = await listRemoteNames(root, signal)
  if (names.length === 0) {
    throw new RouteError(400, 'no-remotes', 'This repository has no remotes configured.')
  }

  let name = requested.trim()
  if (name === '') {
    try {
      const upstream = (await runGit(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], signal)).trim()
      const slash = upstream.indexOf('/')
      const candidate = slash > 0 ? upstream.slice(0, slash) : ''
      if (candidate !== '' && names.includes(candidate)) name = candidate
    } catch {
      // No upstream configured: fall back to origin below.
    }
  }
  if (name === '') name = names.includes('origin') ? 'origin' : names[0] ?? ''
  if (!names.includes(name)) {
    throw new RouteError(400, 'unknown-remote', 'That remote is not configured in this repository.', { remote: name })
  }
  // Remote names reach refspecs; keep them to the characters git itself uses.
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new RouteError(400, 'invalid-remote', 'That remote name cannot be used for a pull request.', { remote: name })
  }

  let url = ''
  try {
    // Read the configured URL, not `git remote get-url`: that command applies
    // `url.<base>.insteadOf` rewrites, which would hide the forge behind a
    // mirror host even though the repository is still a GitHub/Gitee/GitLab one.
    const values = await runGit(root, ['config', '--get-all', `remote.${name}.url`], signal)
    url = values.split(/\r?\n/).map(value => value.trim()).find(value => value !== '') ?? ''
  } catch {
    url = ''
  }
  if (url === '') {
    throw new RouteError(400, 'unknown-remote', 'That remote has no URL.', { remote: name })
  }
  return { name, url }
}

import { RouteError } from '../errors.js'
import { gitFailure, runGit } from '../git.js'
import { resolveRepository } from '../repository.js'
import type { ResolvePayload, RouteContext } from '../types.js'

/**
 * Resolve one ref (a commit hash, branch, tag, or revision expression) to the
 * commit it points at, with the subject used to label it in the UI.
 */
export async function resolveRef(context: RouteContext, url: URL, signal: AbortSignal): Promise<ResolvePayload> {
  const repo = await resolveRepository(context, url.searchParams.get('path'), signal)
  const ref = (url.searchParams.get('ref') ?? '').trim()
  if (ref === '' || ref.startsWith('-') || ref.includes('\0') || /[\r\n]/.test(ref)) {
    throw new RouteError(400, 'invalid-ref', 'Enter a commit or a ref.', { path: repo.root })
  }
  let hash: string
  try {
    hash = (await runGit(repo.root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], signal)).trim()
  } catch {
    throw new RouteError(400, 'ref-not-found', 'That commit could not be resolved in this repository.', {
      path: repo.root,
      ref,
    })
  }
  let output: string
  try {
    output = await runGit(repo.root, [
      'log',
      '-1',
      '--date=iso-strict',
      '--encoding=UTF-8',
      '--pretty=format:%H%x1f%h%x1f%an%x1f%aI%x1f%s',
      hash,
    ], signal)
  } catch (error) {
    throw gitFailure(error).withDetails({ path: repo.root })
  }
  const [full = '', short = '', author = '', date = '', subject = ''] = output.split('\x1f')
  return { ok: true, hash: full === '' ? hash : full, shortHash: short, author, date, subject }
}

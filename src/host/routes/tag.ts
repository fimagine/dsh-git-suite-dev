import { RouteError } from '../errors.js'
import { gitFailure, runGit } from '../git.js'
import { resolveRepository } from '../repository.js'
import type { RouteContext, TagInfoPayload } from '../types.js'

/** Read one tag: its commit, subject, and annotation message. */
export async function readTag(context: RouteContext, url: URL, signal: AbortSignal): Promise<TagInfoPayload> {
  const repo = await resolveRepository(context, url.searchParams.get('path'), signal)
  const name = (url.searchParams.get('name') ?? '').trim()
  if (name === '' || name.startsWith('-') || name.includes('\0') || /[\r\n]/.test(name)) {
    throw new RouteError(400, 'invalid-tag', 'Enter a valid tag name.', { path: repo.root })
  }
  const ref = `refs/tags/${name}`
  let output: string
  try {
    output = await runGit(repo.root, ['for-each-ref', '--format=%(objecttype)%00%(contents)%00%(objectname)', ref], signal)
  } catch (error) {
    throw gitFailure(error).withDetails({ path: repo.root })
  }
  if (output.trim() === '') {
    throw new RouteError(404, 'tag-not-found', 'That tag is not configured in this repository.', { path: repo.root, name })
  }
  const [objectType = '', contents = '', objectName = ''] = output.split('\x00')
  let hash: string
  try {
    hash = (await runGit(repo.root, ['rev-parse', '--verify', `${ref}^{commit}`], signal)).trim()
  } catch {
    throw new RouteError(400, 'invalid-tag', 'That tag does not point at a commit.', { path: repo.root, name })
  }
  let log = ''
  try {
    log = await runGit(repo.root, ['log', '-1', '--encoding=UTF-8', '--pretty=format:%h%x1f%s', hash], signal)
  } catch {
    log = ''
  }
  const [shortHash = '', subject = ''] = log.split('\x1f')
  const annotated = objectType.trim() === 'tag'
  return {
    ok: true,
    name,
    hash,
    shortHash,
    subject,
    message: annotated ? contents.trim() : '',
    annotated,
    objectHash: objectName.trim(),
  }
}

import { runGit } from '../git.js'
import { resolveRepository } from '../repository.js'
import type { ReflogPayload, RouteContext } from '../types.js'

const DEFAULT_LIMIT = 60
const MAX_LIMIT = 200

/** `mode=reflog`: recent HEAD movements, newest first. */
export async function readReflog(
  context: RouteContext,
  url: URL,
  signal: AbortSignal,
): Promise<ReflogPayload> {
  const repo = await resolveRepository(context, url.searchParams.get('path') ?? '', signal)
  const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? '', 10)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT) : DEFAULT_LIMIT
  const output = await runGit(
    repo.root,
    ['reflog', 'show', '--format=%H%x00%h%x00%gd%x00%gs%x00%an%x00%ai', '-n', String(limit)],
    signal,
  )
  const entries = output
    .split(/\r?\n/)
    .filter(line => line !== '')
    .map(line => {
      const [hash = '', shortHash = '', selector = '', action = '', author = '', date = ''] = line.split('\u0000')
      return { hash, shortHash, selector, action, author, date }
    })
    .filter(entry => entry.hash !== '')
  return { ok: true, entries }
}

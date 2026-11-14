import { RouteError } from '../errors.js'
import { gitFailure, runGit } from '../git.js'
import { resolveRepository } from '../repository.js'
import type { RouteContext, TagStatusPayload } from '../types.js'

/** Network reads stay short: an unreachable remote should fail instead of hanging. */
const LS_REMOTE_TIMEOUT_MS = 20_000

function parseTagRefs(output: string): Map<string, string> {
  const tags = new Map<string, string>()
  for (const line of output.split(/\r?\n/)) {
    const [hash = '', ref = ''] = line.split('\t')
    if (hash === '' || !ref.startsWith('refs/tags/')) continue
    const name = ref.slice('refs/tags/'.length)
    if (name.endsWith('^{}')) tags.set(name.slice(0, -3), hash)
    else if (!tags.has(name)) tags.set(name, hash)
  }
  return tags
}

/** Local tags resolved to their commit (`show-ref -d` peels annotated tags). */
async function localTags(root: string, signal: AbortSignal): Promise<Map<string, string>> {
  const tags = new Map<string, string>()
  let output = ''
  try {
    output = await runGit(root, ['show-ref', '--tags', '-d'], signal)
  } catch {
    return tags
  }
  for (const line of output.split(/\r?\n/)) {
    const [hash = '', ref = ''] = line.split(' ')
    if (hash === '' || !ref.startsWith('refs/tags/')) continue
    const name = ref.slice('refs/tags/'.length)
    if (name.endsWith('^{}')) tags.set(name.slice(0, -3), hash)
    else if (!tags.has(name)) tags.set(name, hash)
  }
  return tags
}

/** Compare local tags with one remote's tags, resolving annotated tags to commits. */
export async function readTagStatus(context: RouteContext, url: URL, signal: AbortSignal): Promise<TagStatusPayload> {
  const repo = await resolveRepository(context, url.searchParams.get('path'), signal)
  const remote = (url.searchParams.get('remote') ?? '').trim()
  if (remote === '' || remote.startsWith('-') || remote.includes('\0') || /[\r\n\s]/.test(remote)) {
    throw new RouteError(400, 'invalid-remote', 'That remote name is not valid.', { path: repo.root })
  }
  const remotes = (await runGit(repo.root, ['remote'], signal))
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(item => item !== '')
  if (!remotes.includes(remote)) {
    throw new RouteError(404, 'remote-not-found', 'That remote is not configured in this repository.', { remote })
  }
  const local = await localTags(repo.root, signal)
  let output: string
  try {
    output = await runGit(repo.root, ['ls-remote', '--tags', remote], signal, LS_REMOTE_TIMEOUT_MS)
  } catch (error) {
    throw gitFailure(error).withDetails({ remote })
  }
  const remoteTags = parseTagRefs(output)
  const statuses: TagStatusPayload['statuses'] = {}
  for (const [name, hash] of local) {
    const remoteHash = remoteTags.get(name)
    statuses[name] = remoteHash === undefined ? 'local-only' : remoteHash === hash ? 'same' : 'different'
  }
  const remoteOnly = [...remoteTags.keys()].filter(name => !local.has(name)).sort((left, right) => left.localeCompare(right))
  return { ok: true, remote, statuses, remoteOnly }
}

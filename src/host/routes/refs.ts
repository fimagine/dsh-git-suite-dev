import { detectForge, toForgeInfo } from '../forge/detect.js'
import { gitFailure, runGit } from '../git.js'
import { resolveRepository } from '../repository.js'
import type { Branch, ForgeInfo, RouteContext } from '../types.js'

export interface TagRef {
  ref: string
  name: string
  hash: string
  date: string
}

export interface StashRef {
  /** Reflog selector, e.g. `stash@{0}`. */
  ref: string
  /** Commit the stash points at. */
  hash: string
  date: string
  message: string
}

export interface RemoteGroup {
  name: string
  url: string
  branches: Branch[]
  /** The forge this remote points at, when it is a supported platform. */
  forge?: ForgeInfo | null
}

export interface SubmoduleRef {
  /** Repository-relative submodule path. */
  path: string
  /** Display name: the last path segment. */
  name: string
}

export interface RefsPayload {
  ok: true
  repoRoot: string
  /** Checked-out branch, or `detached`. */
  current: string
  /** Local branches. */
  branches: Branch[]
  tags: TagRef[]
  remotes: RemoteGroup[]
  stashes: StashRef[]
  submodules: SubmoduleRef[]
}

const FIELD = '\x1f'
const NULL = '\0'

/** Parse the local/remote branch rows shared by the branches route and the refs tree. */
export function parseBranches(output: string, current: string): { branches: Branch[]; remotes: RemoteGroup[] } {
  const branches: Branch[] = []
  const remoteMap = new Map<string, Branch[]>()

  for (const line of output.split(/\r?\n/)) {
    if (line.trim() === '') continue
    const [ref = '', name = '', symref = '', hash = '', upstream = '', track = ''] = line.split(NULL)
    if (!ref || !name || symref) continue
    if (ref.startsWith('refs/heads/')) {
      const aheadMatch = /ahead (\d+)/.exec(track)
      const behindMatch = /behind (\d+)/.exec(track)
      branches.push({
        ref,
        name,
        kind: 'local',
        hash: hash || '',
        current: name === current,
        ...(upstream === '' ? {} : { upstream }),
        ...(aheadMatch === null ? {} : { ahead: Number(aheadMatch[1]) }),
        ...(behindMatch === null ? {} : { behind: Number(behindMatch[1]) }),
        ...(track.includes('gone') ? { gone: true } : {}),
      })
      continue
    }
    if (!ref.startsWith('refs/remotes/')) continue
    const rest = name.startsWith('refs/remotes/') ? name.slice('refs/remotes/'.length) : name
    const slash = rest.indexOf('/')
    if (slash <= 0) continue
    const remoteName = rest.slice(0, slash)
    const group = remoteMap.get(remoteName)
    const branch: Branch = { ref, name, kind: 'remote', hash: hash || '', current: false }
    if (group === undefined) remoteMap.set(remoteName, [branch])
    else group.push(branch)
  }

  branches.sort((left, right) => left.name.localeCompare(right.name))
  const remotes = [...remoteMap.entries()]
    .map(([name, list]) => ({ name, url: '', branches: list.sort((left, right) => left.name.localeCompare(right.name)) }))
    .sort((left, right) => left.name.localeCompare(right.name))
  return { branches, remotes }
}

function parseTags(output: string): TagRef[] {
  const tags: TagRef[] = []
  for (const line of output.split(/\r?\n/)) {
    if (line.trim() === '') continue
    const [ref = '', name = '', hash = '', date = ''] = line.split(NULL)
    if (!ref || !name) continue
    tags.push({ ref, name, hash: hash || '', date })
  }
  return tags
}

function parseStashes(output: string): StashRef[] {
  const stashes: StashRef[] = []
  for (const line of output.split(/\r?\n/)) {
    if (line.trim() === '') continue
    const [ref = '', hash = '', date = '', message = ''] = line.split(FIELD)
    if (!ref || !hash) continue
    stashes.push({ ref, hash, date, message })
  }
  return stashes
}

/** Parse `git submodule status`; paths may contain spaces. */
export function parseSubmodules(output: string): SubmoduleRef[] {
  const submodules: SubmoduleRef[] = []
  for (const line of output.split(/\r?\n/)) {
    if (line.trim() === '') continue
    const match = /^[ +\-U]?([0-9a-f]{7,64})\s+(.+?)(?:\s+\([^)]*\))?$/.exec(line)
    if (match === null) continue
    const path = (match[2] ?? '').trim()
    if (path === '') continue
    submodules.push({ path, name: path.split('/').pop() ?? path })
  }
  return submodules
}

/** Parse `git remote -v` into one fetch URL per remote name. */
function parseRemoteUrls(output: string): Map<string, string> {
  const urls = new Map<string, string>()
  for (const line of output.split(/\r?\n/)) {
    const match = /^(\S+)\s+(.+?)\s+\((fetch|push)\)$/.exec(line.trim())
    if (match === null) continue
    const name = match[1] ?? ''
    const remoteUrl = match[2] ?? ''
    if (name !== '' && remoteUrl !== '' && !urls.has(name)) urls.set(name, remoteUrl)
  }
  return urls
}

/** Read the branch/tag/remote/stash/submodule tree for one repository. */
export async function readRefs(context: RouteContext, url: URL, signal: AbortSignal): Promise<RefsPayload> {
  const repo = await resolveRepository(context, url.searchParams.get('path'), signal)
  try {
    const [currentOutput, branchesOutput, tagsOutput, stashesOutput, submodulesOutput, remoteUrlsOutput] = await Promise.all([
      runGit(repo.root, ['branch', '--show-current'], signal),
      runGit(repo.root, [
        'for-each-ref',
        '--format=%(refname)%00%(refname:short)%00%(symref)%00%(objectname:short)%00%(upstream:short)%00%(upstream:track)',
        'refs/heads',
        'refs/remotes',
      ], signal),
      runGit(repo.root, [
        'for-each-ref',
        '--format=%(refname)%00%(refname:short)%00%(objectname:short)%00%(creatordate:iso-strict)',
        'refs/tags',
      ], signal),
      runGit(repo.root, [
        'stash',
        'list',
        '--format=%gd%x1f%H%x1f%cI%x1f%gs',
      ], signal),
      runGit(repo.root, ['submodule', 'status'], signal),
      runGit(repo.root, ['remote', '-v'], signal),
    ])

    const current = currentOutput.trim()
    const { branches, remotes: parsedRemotes } = parseBranches(branchesOutput, current)
    const remoteUrls = parseRemoteUrls(remoteUrlsOutput)
    const remoteNames = [...new Set([...remoteUrls.keys(), ...parsedRemotes.map(group => group.name)])]
      .sort((left, right) => left.localeCompare(right))
    const remotes = remoteNames.map(name => {
      const url = remoteUrls.get(name) ?? ''
      const target = url === '' ? null : detectForge(url)
      return {
        name,
        url,
        branches: parsedRemotes.find(group => group.name === name)?.branches ?? [],
        forge: target === null ? null : toForgeInfo(target),
      }
    })
    return {
      ok: true,
      repoRoot: repo.root,
      current: current === '' ? 'detached' : current,
      branches,
      tags: parseTags(tagsOutput),
      remotes,
      stashes: parseStashes(stashesOutput),
      submodules: parseSubmodules(submodulesOutput),
    }
  } catch (error) {
    throw gitFailure(error).withDetails({ path: repo.root })
  }
}

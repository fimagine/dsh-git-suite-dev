import { gitFailure, runGit } from '../git.js'
import { resolveRepository } from '../repository.js'
import type { Branch, RouteContext } from '../types.js'

export interface BranchesPayload {
  ok: true
  repoRoot: string
  current: string
  branches: Branch[]
}

/** List local and remote branches, marking the checked-out branch. */
export async function readBranches(context: RouteContext, url: URL, signal: AbortSignal): Promise<BranchesPayload> {
  const repo = await resolveRepository(context, url.searchParams.get('path'), signal)
  try {
    const [currentOutput, refsOutput] = await Promise.all([
      runGit(repo.root, ['branch', '--show-current'], signal),
      runGit(repo.root, [
        'for-each-ref',
        '--format=%(refname)%00%(refname:short)%00%(symref)%00%(objectname:short)',
        'refs/heads',
        'refs/remotes',
      ], signal),
    ])

    const current = currentOutput.trim()
    const branches: Branch[] = []
    for (const line of refsOutput.split(/\r?\n/)) {
      if (line.trim() === '') continue
      const [ref = '', name = '', symref = '', hash = ''] = line.split('\0')
      if (!ref || !name || symref) continue
      const kind = ref.startsWith('refs/heads/') ? 'local' as const : ref.startsWith('refs/remotes/') ? 'remote' as const : null
      if (kind === null) continue
      branches.push({
        ref,
        name,
        kind,
        hash: hash || '',
        current: kind === 'local' && name === current,
      })
    }
    branches.sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === 'local' ? -1 : 1
      return left.name.localeCompare(right.name)
    })

    return {
      ok: true,
      repoRoot: repo.root,
      current: current === '' ? 'detached' : current,
      branches,
    }
  } catch (error) {
    throw gitFailure(error).withDetails({ path: repo.root })
  }
}

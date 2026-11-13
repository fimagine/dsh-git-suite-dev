import { stat } from 'node:fs/promises'
import { normalize, resolve } from 'node:path'
import { RouteError } from './errors.js'
import { gitFailure, runGit } from './git.js'
import type { RouteContext } from './types.js'

export interface Repository {
  /** Path the caller asked for. */
  requested: string
  /** Repository top level reported by git. */
  root: string
}

/** Validate the requested path and resolve the Git repository that contains it. */
export async function resolveRepository(
  context: RouteContext,
  rawPath: string | null,
  signal?: AbortSignal,
): Promise<Repository> {
  const requested = typeof rawPath === 'string' && rawPath.trim() !== '' ? rawPath.trim() : context.defaultPath()
  const absolute = resolve(requested)

  let info
  try {
    info = await stat(absolute)
  } catch {
    throw new RouteError(400, 'invalid-path', 'That path does not exist or cannot be read.', { path: absolute })
  }
  if (!info.isDirectory()) {
    throw new RouteError(400, 'invalid-path', 'That path is not a directory.', { path: absolute })
  }

  let root: string
  try {
    root = (await runGit(absolute, ['rev-parse', '--show-toplevel'], signal)).trim()
  } catch (error) {
    throw gitFailure(error).withDetails({ path: absolute })
  }
  if (root === '') {
    throw new RouteError(400, 'not-a-repo', 'This directory is not inside a Git repository.', { path: absolute })
  }

  return { requested: absolute, root: normalize(root) }
}

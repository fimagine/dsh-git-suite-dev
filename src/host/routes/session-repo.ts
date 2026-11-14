import { RouteError } from '../errors.js'
import { resolveRepository } from '../repository.js'
import type { RouteContext } from '../types.js'

export interface SessionRepoPayload {
  ok: true
  /** Repository top level for the Session's working directory, or null when it has none. */
  path: string | null
  /** The Session's working directory, when the host knew it. */
  cwd: string | null
}

/**
 * Resolve the Git repository of one Session's working directory, so the
 * sidebar panel can open on the workspace the user is actually in.
 */
export async function readSessionRepo(
  context: RouteContext,
  url: URL,
  signal: AbortSignal,
): Promise<SessionRepoPayload> {
  const sessionId = url.searchParams.get('session')?.trim() ?? ''
  if (sessionId === '') throw new RouteError(400, 'no-session', 'A session id is required.')
  const cwd = context.sessionDirectory?.(sessionId) ?? null
  if (cwd === null) return { ok: true, path: null, cwd: null }
  try {
    const repo = await resolveRepository(context, cwd, signal)
    return { ok: true, path: repo.root, cwd }
  } catch (error) {
    if (error instanceof RouteError && (error.code === 'not-a-repo' || error.code === 'invalid-path')) {
      return { ok: true, path: null, cwd }
    }
    throw error
  }
}

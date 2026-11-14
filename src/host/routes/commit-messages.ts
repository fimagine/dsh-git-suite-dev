import { runGit } from '../git.js'
import { resolveRepository } from '../repository.js'
import type { CommitMessagesPayload, RouteContext } from '../types.js'

const MAX_MESSAGES = 40
const SCAN_LIMIT = 120

/** `mode=commit-messages`: recent, de-duplicated commit messages, newest first. */
export async function readCommitMessages(
  context: RouteContext,
  url: URL,
  signal: AbortSignal,
): Promise<CommitMessagesPayload> {
  const repo = await resolveRepository(context, url.searchParams.get('path') ?? '', signal)
  const output = await runGit(repo.root, ['log', `-n`, String(SCAN_LIMIT), '--format=%B%x00'], signal)
  const seen = new Set<string>()
  const messages: string[] = []
  for (const raw of output.split('\u0000')) {
    const text = raw.replace(/^\r?\n+/, '').trim()
    if (text === '' || seen.has(text)) continue
    seen.add(text)
    messages.push(text)
    if (messages.length >= MAX_MESSAGES) break
  }
  return { ok: true, messages }
}

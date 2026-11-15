import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AgentDefaultModelService, LlmService, LlmStreamChunk } from './dsh.js'
import { RouteError } from './errors.js'
import { detectForge } from './forge/detect.js'
import { getPull } from './forge/index.js'
import { resolveRemote } from './forge/remote.js'
import { resolveForgeToken } from './forge/token.js'
import { admitHeaders, failure, json } from './http.js'
import { resolveRepository } from './repository.js'
import type { PullDetail, RouteContext } from './types.js'
import { readReviewContext, type ReviewContext, type ReviewContextMode } from './pr-review-context.js'

const MAX_BODY_BYTES = 64 * 1024
const MAX_PATCH_CHARS = 36_000
const MAX_DESCRIPTION_CHARS = 4_000
const MAX_REVIEW_CHARS = 20_000

interface ReviewBody {
  path?: unknown
  remote?: unknown
  number?: unknown
  language?: unknown
  /** Full-file context source chosen by the user. */
  context?: unknown
}

function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name]
  if (value === undefined) return null
  return Array.isArray(value) ? value.join(', ') : value
}

async function readJson(req: IncomingMessage): Promise<ReviewBody> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new RouteError(413, 'body-too-large', 'The request body is too large.')
    chunks.push(buffer)
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object')
    return parsed as ReviewBody
  } catch {
    throw new RouteError(400, 'invalid-body', 'The request body must be a JSON object.')
  }
}

async function send(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })
  res.end(Buffer.from(await response.arrayBuffer()))
}

function diffExcerpt(pull: PullDetail): { text: string; truncated: boolean } {
  let remaining = MAX_PATCH_CHARS
  let truncated = false
  const parts: string[] = []
  for (const file of pull.files.slice(0, 60)) {
    const header = `### ${file.path} (${file.status}, +${file.additions ?? '?'} -${file.deletions ?? '?'})`
    if (remaining <= header.length + 2) {
      truncated = true
      break
    }
    const patch = file.patch.trim()
    const room = Math.max(0, remaining - header.length - 2)
    const body = patch.slice(0, room)
    parts.push(`${header}\n${body === '' ? '(no textual diff, likely binary)' : body}`)
    remaining -= header.length + body.length + 2
    if (body.length < patch.length) {
      truncated = true
      break
    }
  }
  return { text: parts.join('\n\n'), truncated }
}

function buildPrompt(pull: PullDetail, language: string, context: ReviewContext): { prompt: string; truncated: boolean } {
  const diff = diffExcerpt(pull)
  const description = pull.body.trim().slice(0, MAX_DESCRIPTION_CHARS)
  const commits = pull.commits.slice(0, 30).map(commit => `- ${commit.shortHash} ${commit.subject}`).join('\n')
  const fullFiles = context.files.length === 0
    ? '(complete file contents unavailable; review the diff only)'
    : context.files.map(file => `### ${file.path}\n${file.content}`).join('\n\n')
  return {
    truncated: diff.truncated || context.truncated,
    prompt: [
      `Review pull request #${pull.number}: ${pull.title}`,
      `Source: ${pull.sourceBranch} → ${pull.targetBranch}`,
      `Author: ${pull.author === '' ? 'unknown' : pull.author}`,
      '',
      'Description:',
      description === '' ? '(none)' : description,
      '',
      `Commits (${pull.commits.length}):`,
      commits === '' ? '(none)' : commits,
      '',
      `Changed files (${pull.files.length}${pull.filesTruncated ? '+' : ''}):`,
      diff.text === '' ? '(no textual diff)' : diff.text,
      diff.truncated ? '\n[diff truncated]' : '',
      '',
      'Full contents of changed files at the PR head (read from a temporary read-only checkout; nothing was executed):',
      fullFiles,
      context.truncated ? '\n[file contents truncated]' : '',
      '',
      'Write a code review in Markdown. Focus only on the changes above:',
      '- Correctness bugs, edge cases, and regressions.',
      '- Security, data-loss, and performance risks.',
      '- Missing or inadequate tests.',
      '- Concrete suggestions with file paths and, when possible, hunk context.',
      'Use sections: Summary, Issues (with severity high/medium/low), Tests, Suggestions.',
      'If something is uncertain or not visible in the excerpt, say so instead of guessing.',
      'Do not praise, do not repeat the description, and do not invent code that is not in the diff.',
      `Respond in ${language}.`,
    ].join('\n'),
  }
}

/**
 * POST /git-suite/pr-ai-review: fetch one pull request and ask the deployment's
 * default model for a read-only Markdown review. Nothing is posted to the forge.
 */
export function createPullAiReviewHandler(
  context: RouteContext,
  llm: LlmService,
  defaultModel: AgentDefaultModelService,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (!admitHeaders(name => header(req, name))) {
      await send(res, json({
        ok: false,
        error: { code: 'forbidden', message: 'This request is not allowed to review a pull request.' },
      }, 403))
      return
    }
    if (req.method !== 'POST') {
      await send(res, json({
        ok: false,
        error: { code: 'method-not-allowed', message: 'Reviewing a pull request requires POST.' },
      }, 405))
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120_000)
    res.once('close', () => controller.abort())
    const signal = controller.signal
    try {
      const body = await readJson(req)
      const rawNumber = typeof body.number === 'number' ? body.number : Number.NaN
      if (!Number.isInteger(rawNumber) || rawNumber <= 0 || rawNumber > 2_147_483_647) {
        throw new RouteError(400, 'invalid-number', 'That pull request number is not valid.')
      }
      const repo = await resolveRepository(context, typeof body.path === 'string' ? body.path : '', signal)
      const remote = await resolveRemote(repo.root, typeof body.remote === 'string' ? body.remote : '', signal)
      const target = detectForge(remote.url)
      if (target === null) {
        throw new RouteError(400, 'forge-unsupported', 'This remote is not hosted on a supported forge.', { remote: remote.name })
      }

      const token = await resolveForgeToken(repo.root, target, signal)
      let pull: PullDetail
      try {
        pull = await getPull(target, rawNumber, token, signal, true)
      } catch (error) {
        if (error instanceof RouteError) throw error.withDetails({ remote: remote.name })
        throw error
      }
      if (pull.files.length === 0) {
        throw new RouteError(400, 'no-diff', 'This pull request has no changed files to review.')
      }
      const contextMode: ReviewContextMode = body.context === 'diff' || body.context === 'api' || body.context === 'worktree'
        ? body.context
        : 'auto'
      const reviewContext = await readReviewContext(
        repo.root,
        remote.name,
        target,
        pull,
        rawNumber,
        token,
        signal,
        contextMode,
      )

      let selection: { provider: string; model: string; reasoningEffort?: string }
      try {
        selection = defaultModel.currentSelection()
      } catch {
        throw new RouteError(500, 'no-model', 'No default model is configured.')
      }
      if (selection.provider === '' || selection.model === '') {
        throw new RouteError(500, 'no-model', 'No default model is configured.')
      }

      const language = typeof body.language === 'string' && body.language.toLowerCase().startsWith('zh')
        ? 'Simplified Chinese'
        : 'English'
      const { prompt, truncated } = buildPrompt(pull, language, reviewContext)

      const runAttempt = async (
        maxTokens: number,
        includeReasoning: boolean,
      ): Promise<{ text: string; finish: LlmStreamChunk['reason']; reasoningChars: number }> => {
        let delta = ''
        let blockText = ''
        let reasoning = ''
        let finish: LlmStreamChunk['reason']
        try {
          for await (const chunk of llm.stream({
            provider: selection.provider,
            model: selection.model,
            ...(includeReasoning && selection.reasoningEffort !== undefined
              ? { reasoningEffort: selection.reasoningEffort }
              : {}),
            system: 'You are a senior software engineer reviewing a pull request. Be specific, skeptical, and concise. Output Markdown only.',
            messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
            maxTokens,
            temperature: 0.2,
            signal,
          })) {
            if (chunk.type === 'text-delta' && typeof chunk.text === 'string') delta += chunk.text
            else if (chunk.type === 'reasoning-delta' && typeof chunk.text === 'string') reasoning += chunk.text
            else if (
              chunk.type === 'block-end'
              && chunk.block?.type === 'text'
              && typeof chunk.block.text === 'string'
            ) {
              blockText += chunk.block.text
            } else if (chunk.type === 'finish') {
              finish = chunk.reason
            }
          }
        } catch (error) {
          throw new RouteError(502, 'llm-failed', error instanceof Error ? error.message : 'The model request failed.')
        }
        if (finish?.kind === 'error' || finish?.kind === 'aborted') {
          throw new RouteError(502, 'llm-failed', finish.failure?.message ?? 'The model request failed.')
        }
        return { text: delta === '' ? blockText : delta, finish, reasoningChars: reasoning.length }
      }

      // Reasoning models can consume the whole output budget before emitting
      // visible text. Start with room for both, then retry once without the
      // reasoning effort if the first attempt produced no review.
      let attempt = await runAttempt(6_000, true)
      if (attempt.text.trim() === '' && !signal.aborted) {
        attempt = await runAttempt(8_000, false)
      }
      const review = attempt.text.trim().slice(0, MAX_REVIEW_CHARS)
      if (review === '') {
        if (attempt.finish?.kind === 'max-tokens' || attempt.reasoningChars > 0) {
          throw new RouteError(
            502,
            'review-truncated',
            'The model used its output budget before writing the review. Try diff-only mode or a smaller context.',
          )
        }
        throw new RouteError(502, 'empty-review', 'The model returned an empty review.')
      }
      await send(res, json({
        ok: true,
        review,
        model: selection.model,
        files: pull.files.length,
        truncated,
        context: reviewContext.mode,
        contextFiles: reviewContext.files.length,
      }))
    } catch (error) {
      await send(res, failure(error))
    } finally {
      clearTimeout(timeout)
    }
  }
}

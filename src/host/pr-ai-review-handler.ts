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

const MAX_BODY_BYTES = 64 * 1024
const MAX_PATCH_CHARS = 36_000
const MAX_DESCRIPTION_CHARS = 4_000
const MAX_REVIEW_CHARS = 20_000

interface ReviewBody {
  path?: unknown
  remote?: unknown
  number?: unknown
  language?: unknown
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

function buildPrompt(pull: PullDetail, language: string): { prompt: string; truncated: boolean } {
  const diff = diffExcerpt(pull)
  const description = pull.body.trim().slice(0, MAX_DESCRIPTION_CHARS)
  const commits = pull.commits.slice(0, 30).map(commit => `- ${commit.shortHash} ${commit.subject}`).join('\n')
  return {
    truncated: diff.truncated,
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
      const { prompt, truncated } = buildPrompt(pull, language)

      let output = ''
      let finish: LlmStreamChunk['reason']
      try {
        for await (const chunk of llm.stream({
          provider: selection.provider,
          model: selection.model,
          ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }),
          system: 'You are a senior software engineer reviewing a pull request. Be specific, skeptical, and concise. Output Markdown only.',
          messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
          maxTokens: 2_400,
          temperature: 0.2,
          signal,
        })) {
          if (chunk.type === 'text-delta' && typeof chunk.text === 'string') output += chunk.text
          else if (chunk.type === 'finish') finish = chunk.reason
        }
      } catch (error) {
        throw new RouteError(502, 'llm-failed', error instanceof Error ? error.message : 'The model request failed.')
      }
      if (finish?.kind === 'error' || finish?.kind === 'aborted') {
        throw new RouteError(502, 'llm-failed', finish.failure?.message ?? 'The model request failed.')
      }
      const review = output.trim().slice(0, MAX_REVIEW_CHARS)
      if (review === '') {
        throw new RouteError(502, 'empty-review', 'The model returned an empty review.')
      }
      await send(res, json({
        ok: true,
        review,
        model: selection.model,
        files: pull.files.length,
        truncated,
      }))
    } catch (error) {
      await send(res, failure(error))
    } finally {
      clearTimeout(timeout)
    }
  }
}

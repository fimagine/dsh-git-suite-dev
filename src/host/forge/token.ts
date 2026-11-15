import { execFile } from 'node:child_process'
import { runGit, runGitWithInput } from '../git.js'
import type { ForgeProvider } from '../types.js'
import type { ForgeTarget } from './detect.js'

const CLI_TIMEOUT_MS = 5000
const CREDENTIAL_TIMEOUT_MS = 6000
const TOKEN_TTL_MS = 5 * 60_000
const MISSING_TTL_MS = 60_000

interface TokenEntry {
  /** null means "looked up, nothing found"; the next attempt waits for the TTL. */
  value: string | null
  expires: number
}

const tokenCache = new Map<string, TokenEntry>()

/** Forget resolved tokens, e.g. right after a new one was stored. */
export function clearForgeTokenCache(): void {
  tokenCache.clear()
}

function cachedToken(target: ForgeTarget): { hit: boolean; value: string | null } {
  const key = `${target.provider}:${target.host}`
  const entry = tokenCache.get(key)
  if (entry === undefined) return { hit: false, value: null }
  if (entry.expires <= Date.now()) {
    tokenCache.delete(key)
    return { hit: false, value: null }
  }
  return { hit: true, value: entry.value }
}

function rememberToken(target: ForgeTarget, token: string | null): void {
  tokenCache.set(`${target.provider}:${target.host}`, {
    value: token,
    expires: Date.now() + (token === null ? MISSING_TTL_MS : TOKEN_TTL_MS),
  })
}

const ENV_NAMES: Record<ForgeProvider, readonly string[]> = {
  github: ['GITHUB_TOKEN', 'GH_TOKEN'],
  gitee: ['GITEE_TOKEN', 'GITEE_ACCESS_TOKEN'],
  gitlab: ['GITLAB_TOKEN', 'GITLAB_ACCESS_TOKEN'],
}

/** A token from the environment, when one is set. */
function environmentToken(provider: ForgeProvider): string | null {
  for (const name of ENV_NAMES[provider]) {
    const value = process.env[name]
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return null
}

/** Ask the `gh` CLI for its stored token (GitHub only, when it is installed). */
function githubCliToken(host: string, signal?: AbortSignal): Promise<string | null> {
  return new Promise(resolve => {
    execFile(
      'gh',
      ['auth', 'token', '--hostname', host],
      {
        timeout: CLI_TIMEOUT_MS,
        windowsHide: true,
        encoding: 'utf8',
        env: { ...process.env, GH_PROMPT_DISABLED: '1' },
        signal,
      },
      (error, stdout) => {
        if (error !== null) {
          resolve(null)
          return
        }
        const token = stdout.trim()
        resolve(token === '' ? null : token)
      },
    )
  })
}

/**
 * Read a stored HTTPS credential for this host through the repository's
 * credential helper. Interactive prompts are disabled, so a missing entry
 * resolves to null instead of opening a login window.
 */
async function storedCredential(repoRoot: string, target: ForgeTarget, signal?: AbortSignal): Promise<string | null> {
  let useHttpPath = false
  try {
    useHttpPath = (await runGit(repoRoot, ['config', '--get', 'credential.useHttpPath'], signal)).trim() === 'true'
  } catch {
    useHttpPath = false
  }
  const input = [
    'protocol=https',
    `host=${target.host}`,
    ...(useHttpPath ? [`path=${target.projectPath}`] : []),
    '',
    '',
  ].join('\n')
  try {
    const output = await runGitWithInput(
      repoRoot,
      ['credential', 'fill'],
      input,
      signal,
      CREDENTIAL_TIMEOUT_MS,
      { GCM_INTERACTIVE: 'never', GIT_ASKPASS: '', SSH_ASKPASS: '' },
    )
    const password = /^password=(.*)$/m.exec(output)?.[1]?.trim() ?? ''
    return password === '' ? null : password
  } catch {
    return null
  }
}

/**
 * Resolve a forge token for one remote, in order: environment variable, the
 * GitHub CLI's stored login, then the git credential helper. The token lives
 * only in the host process and is never returned to the client.
 */
export async function resolveForgeToken(
  repoRoot: string,
  target: ForgeTarget,
  signal?: AbortSignal,
): Promise<string | null> {
  const cached = cachedToken(target)
  if (cached.hit) return cached.value

  const fromEnvironment = environmentToken(target.provider)
  if (fromEnvironment !== null) {
    rememberToken(target, fromEnvironment)
    return fromEnvironment
  }
  if (target.provider === 'github') {
    const fromCli = await githubCliToken(target.host, signal)
    if (fromCli !== null) {
      rememberToken(target, fromCli)
      return fromCli
    }
  }
  const stored = await storedCredential(repoRoot, target, signal)
  rememberToken(target, stored)
  return stored
}

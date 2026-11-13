import { execFile } from 'node:child_process'
import { readdir, stat } from 'node:fs/promises'
import { basename, join, normalize, resolve } from 'node:path'

const ROUTE_PATH = '/git-log'
const DEFAULT_LIMIT = 50
const MAX_PATCH_CHARS = 400000
const GIT_TIMEOUT_MS = 60000
const GIT_MAX_BUFFER = 64 * 1024 * 1024

export const inject = ['webServer', 'workingDirectory']

class RouteError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  })
}

function failure(error) {
  const status = error instanceof RouteError ? error.status : 500
  const code = error instanceof RouteError ? error.code : 'internal'
  const message = error instanceof Error ? error.message : String(error)
  return json({
    ok: false,
    error: {
      code,
      message: message.slice(0, 2000),
      ...(error?.details === undefined ? {} : { details: error.details }),
    },
  }, status)
}

function admit(request) {
  if (request.headers.get('x-dsh-git-log') !== '1') return false

  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (origin !== null && host !== null) {
    try {
      if (new URL(origin).host !== host) return false
    } catch {
      return false
    }
  }

  const site = request.headers.get('sec-fetch-site')
  if (site !== null && site !== 'same-origin' && site !== 'none') return false
  return true
}

function gitEnvironment() {
  return {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_PAGER: 'cat',
  }
}

function runGit(cwd, args, signal) {
  return new Promise((resolvePromise, reject) => {
    execFile(
      'git',
      ['--no-pager', '-c', 'core.quotepath=false', '-C', cwd, ...args],
      {
        cwd,
        env: gitEnvironment(),
        encoding: 'utf8',
        windowsHide: true,
        timeout: GIT_TIMEOUT_MS,
        maxBuffer: GIT_MAX_BUFFER,
        signal,
      },
      (error, stdout, stderr) => {
        if (error === null) {
          resolvePromise(stdout)
          return
        }
        error.stdout = stdout
        error.stderr = stderr
        reject(error)
      },
    )
  })
}

function gitFailure(error) {
  const stderr = String(error?.stderr ?? '').trim()
  const detail = stderr.slice(0, 1200) || String(error?.message ?? 'Git failed')

  if (error?.code === 'ENOENT') {
    return new RouteError(500, 'git-missing', 'Git is not installed or is not available on PATH.', { detail })
  }
  if (/not a git repository/i.test(stderr)) {
    return new RouteError(400, 'not-a-repo', 'This directory is not inside a Git repository.', { detail })
  }
  if (/does not have any commits yet|has no commits yet/i.test(stderr)) {
    return new RouteError(400, 'empty-repo', 'This repository does not have any commits yet.', { detail })
  }
  if (/bad revision|unknown revision|ambiguous argument/i.test(stderr)) {
    return new RouteError(400, 'bad-commit', 'That commit could not be resolved in this repository.', { detail })
  }
  if (error?.code === 'ABORT_ERR') {
    return new RouteError(499, 'cancelled', 'The request was cancelled.', { detail })
  }
  if (error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
    return new RouteError(500, 'git-output-too-large', 'Git produced more output than the viewer can read.', { detail })
  }
  return new RouteError(500, 'git-failed', detail, { detail })
}

async function repositoryFor(rawPath, defaultPath) {
  const fallback = typeof defaultPath === 'function' ? defaultPath() : defaultPath
  const requested = typeof rawPath === 'string' && rawPath.trim() !== '' ? rawPath.trim() : fallback
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

  let root
  try {
    root = (await runGit(absolute, ['rev-parse', '--show-toplevel'])).trim()
  } catch (error) {
    const failure = gitFailure(error)
    failure.details = { ...failure.details, path: absolute }
    throw failure
  }
  if (root === '') {
    throw new RouteError(400, 'not-a-repo', 'This directory is not inside a Git repository.', { path: absolute })
  }

  return {
    requested: absolute,
    root: normalize(root),
  }
}

function parseLog(output) {
  const commits = []
  for (const raw of output.split('\0')) {
    const record = raw.replace(/^\r?\n+/, '')
    if (record === '') continue
    const fields = record.split('\x1f')
    if (fields.length < 8) continue
    const [hash, shortHash, author, email, date, parents, refs, ...subjectParts] = fields
    if (!/^[0-9a-f]{7,64}$/i.test(hash)) continue
    commits.push({
      hash,
      shortHash,
      author,
      email,
      date,
      parents: parents === '' ? [] : parents.split(' ').filter(Boolean),
      refs: refs === '' ? [] : refs.split(',').map((value) => value.trim()).filter(Boolean),
      subject: subjectParts.join('\x1f') || '(no subject)',
    })
  }
  return commits
}

function parseCommitHeader(output) {
  const fields = output.split('\x1f')
  if (fields.length < 8) {
    throw new RouteError(500, 'git-failed', 'Git returned an unexpected commit header.')
  }
  const [hash, shortHash, author, email, date, parents, refs, subject, ...bodyParts] = fields
  return {
    hash,
    shortHash,
    author,
    email,
    date,
    parents: parents === '' ? [] : parents.split(' ').filter(Boolean),
    refs: refs === '' ? [] : refs.split(',').map((value) => value.trim()).filter(Boolean),
    subject: subject || '(no subject)',
    body: bodyParts.join('\x1f').trim(),
  }
}

function parseNumstat(output) {
  const files = []
  for (const line of output.split(/\r?\n/)) {
    if (line.trim() === '') continue
    const fields = line.split('\t')
    if (fields.length < 3) continue
    const [added, deleted, ...pathParts] = fields
    const path = pathParts.join('\t')
    if (path === '') continue
    const binary = added === '-' || deleted === '-'
    files.push({
      path,
      additions: binary ? null : Number(added),
      deletions: binary ? null : Number(deleted),
      binary,
    })
  }
  return files
}

function parseLimit(raw) {
  const value = (raw ?? '').trim().toLowerCase()
  if (value === 'all') return 0
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_LIMIT
  return parsed
}

function parseOffset(raw) {
  const parsed = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function isBranchRef(value) {
  if (typeof value !== 'string') return false
  if (!value.startsWith('refs/heads/') && !value.startsWith('refs/remotes/')) return false
  if (value.length > 1024 || value.includes('..') || value.includes('@{')) return false
  const forbidden = new Set(['~', '^', ':', '?', '*', '[', '\\'])
  for (const character of value) {
    const code = character.codePointAt(0)
    if (code < 0x20 || code === 0x7f || character.trim() === '' || forbidden.has(character)) return false
  }
  return true
}

async function readBranches(context, url, signal) {
  const repo = await repositoryFor(url.searchParams.get('path'), context.defaultPath)
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
    const branches = []
    for (const line of refsOutput.split(/\r?\n/)) {
      if (line.trim() === '') continue
      const [ref, name, symref, hash] = line.split('\0')
      if (!ref || !name || symref) continue
      const kind = ref.startsWith('refs/heads/') ? 'local' : ref.startsWith('refs/remotes/') ? 'remote' : null
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
    const failure = gitFailure(error)
    failure.details = { ...failure.details, path: repo.root }
    throw failure
  }
}

async function readLog(context, url, signal) {
  const repo = await repositoryFor(url.searchParams.get('path'), context.defaultPath)
  const limit = parseLimit(url.searchParams.get('limit'))
  const offset = parseOffset(url.searchParams.get('offset'))
  const scope = url.searchParams.get('scope') ?? ''
  const ref = (url.searchParams.get('ref') ?? '').trim()
  const limitArgs = limit > 0 ? ['-n', String(limit + 1)] : []
  const offsetArgs = offset > 0 ? [`--skip=${offset}`] : []
  let refArgs = []

  if (scope === 'all') {
    refArgs = ['--branches', '--remotes']
  } else if (scope === 'remotes') {
    refArgs = ['--remotes']
  } else if (ref !== '') {
    if (!isBranchRef(ref)) {
      throw new RouteError(400, 'invalid-ref', 'That branch reference is not valid.', { path: repo.root })
    }
    try {
      await runGit(repo.root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], signal)
    } catch {
      throw new RouteError(400, 'branch-not-found', 'That branch could not be resolved in this repository.', {
        path: repo.root,
        ref,
      })
    }
    refArgs = [ref]
  }

  try {
    const [branchOutput, logOutput] = await Promise.all([
      runGit(repo.root, ['branch', '--show-current'], signal),
      runGit(repo.root, [
        'log',
        '--topo-order',
        '--date=iso-strict',
        '--encoding=UTF-8',
        '--decorate=short',
        '-z',
        '--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%P%x1f%D%x1f%s',
        ...offsetArgs,
        ...limitArgs,
        ...refArgs,
      ], signal),
    ])

    const branch = branchOutput.trim() === '' ? 'detached' : branchOutput.trim()
    const commits = parseLog(logOutput)
    const hasMore = limit > 0 && commits.length > limit
    const page = hasMore ? commits.slice(0, limit) : commits
    return {
      ok: true,
      repoRoot: repo.root,
      repoName: basename(repo.root) || repo.root,
      branch,
      scope: scope === 'all' || scope === 'remotes' ? scope : ref === '' ? 'head' : 'ref',
      ref: ref === '' ? null : ref,
      limit,
      offset,
      hasMore,
      nextOffset: offset + page.length,
      defaultPath: typeof context.defaultPath === 'function' ? context.defaultPath() : context.defaultPath,
      commits: page,
    }
  } catch (error) {
    const failure = gitFailure(error)
    failure.details = { ...failure.details, path: repo.root }
    throw failure
  }
}

async function readCommit(context, url, signal) {
  const repo = await repositoryFor(url.searchParams.get('path'), context.defaultPath)
  const hash = (url.searchParams.get('hash') ?? '').trim().toLowerCase()
  if (!/^[0-9a-f]{4,64}$/.test(hash)) {
    throw new RouteError(400, 'invalid-commit', 'A commit hash is required.', { path: repo.root })
  }

  try {
    const [headerOutput, numstatOutput, patchOutput] = await Promise.all([
      runGit(repo.root, [
        'show',
        '-s',
        '--encoding=UTF-8',
        '--date=iso-strict',
        '--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%P%x1f%D%x1f%s%x1f%b',
        hash,
      ], signal),
      runGit(repo.root, [
        'show',
        '--no-color',
        '--no-ext-diff',
        '--format=',
        '--numstat',
        '--find-renames',
        hash,
      ], signal),
      runGit(repo.root, [
        'show',
        '--no-color',
        '--no-ext-diff',
        '--format=',
        '--patch',
        '--find-renames',
        '--unified=3',
        hash,
      ], signal),
    ])

    const commit = parseCommitHeader(headerOutput)
    const files = parseNumstat(numstatOutput)
    const patchTruncated = patchOutput.length > MAX_PATCH_CHARS
    return {
      ok: true,
      commit: {
        ...commit,
        files,
        patch: patchTruncated ? patchOutput.slice(0, MAX_PATCH_CHARS) : patchOutput,
        patchTruncated,
      },
    }
  } catch (error) {
    const failure = gitFailure(error)
    failure.details = { ...failure.details, path: repo.root, hash }
    throw failure
  }
}

const SCAN_MAX_DEPTH = 3
const SCAN_MAX_ENTRIES = 2500
const SCAN_MAX_PROJECTS = 100
const SCAN_SKIP = new Set([
  '$Recycle.Bin',
  'AppData',
  'Application Data',
  'DerivedData',
  'Pods',
  'Program Files',
  'Program Files (x86)',
  'System Volume Information',
  'Windows',
  'bower_components',
  'build',
  'coverage',
  'dist',
  'jspm_packages',
  'node_modules',
  'obj',
  'out',
  'target',
  'vendor',
])

function projectKey(path) {
  const normalized = normalize(path)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

async function isGitProject(path) {
  try {
    const info = await stat(join(path, '.git'))
    return info.isDirectory() || info.isFile()
  } catch {
    return false
  }
}

async function scanProjects(context, signal) {
  const workspaces = context.workspaces()
  const projects = []
  const seen = new Set()
  let visited = 0
  let truncated = false

  for (const workspace of workspaces) {
    if (projects.length >= SCAN_MAX_PROJECTS) {
      truncated = true
      break
    }

    const queue = [{ path: workspace.path, depth: 0 }]
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      if (signal.aborted) throw new RouteError(499, 'cancelled', 'The request was cancelled.')
      if (visited >= SCAN_MAX_ENTRIES || projects.length >= SCAN_MAX_PROJECTS) {
        truncated = true
        break
      }

      const current = queue[cursor]
      visited += 1

      let info
      try {
        info = await stat(current.path)
      } catch {
        continue
      }
      if (!info.isDirectory()) continue

      if (await isGitProject(current.path)) {
        const key = projectKey(current.path)
        if (!seen.has(key)) {
          seen.add(key)
          projects.push({
            path: normalize(current.path),
            name: basename(current.path) || current.path,
            workspaceId: workspace.id,
            workspaceTitle: workspace.title,
            nested: current.depth > 0,
          })
        }
        continue
      }

      if (current.depth >= SCAN_MAX_DEPTH) continue

      let entries
      try {
        entries = await readdir(current.path, { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.isSymbolicLink()) continue
        if (entry.name.startsWith('.') || SCAN_SKIP.has(entry.name)) continue
        queue.push({ path: join(current.path, entry.name), depth: current.depth + 1 })
      }
    }
  }

  return {
    ok: true,
    workspaces: workspaces.map((workspace) => ({
      id: workspace.id,
      title: workspace.title,
      path: workspace.path,
    })),
    projects,
    truncated,
    defaultPath: context.defaultPath(),
  }
}

function createResource(context) {
  return async function resource(request) {
    if (!admit(request)) {
      return json({
        ok: false,
        error: { code: 'forbidden', message: 'This request is not allowed to read the Git log.' },
      }, 403)
    }

    try {
      const url = new URL(request.url, 'http://dsh.local')
      const mode = url.searchParams.get('mode') ?? 'log'
      if (mode === 'projects') return json(await scanProjects(context, request.signal))
      if (mode === 'branches') return json(await readBranches(context, url, request.signal))
      if (mode === 'log') return json(await readLog(context, url, request.signal))
      if (mode === 'commit') return json(await readCommit(context, url, request.signal))
      return json({
        ok: false,
        error: { code: 'invalid-request', message: 'Unknown viewer mode.' },
      }, 400)
    } catch (error) {
      if (error instanceof RouteError) return failure(error)
      return failure(new RouteError(500, 'internal', error instanceof Error ? error.message : String(error)))
    }
  }
}

export function apply(ctx) {
  const workspaceRegistry = ctx.get('workspaceRegistry')
  const listWorkspaces = () => {
    try {
      return workspaceRegistry?.list?.() ?? []
    } catch {
      return []
    }
  }
  const context = {
    workspaces: listWorkspaces,
    defaultPath() {
      const workspace = listWorkspaces()[0]
      return workspace?.path || ctx.workingDirectory.defaultDirectory || process.cwd()
    },
  }
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE_PATH,
    resource: createResource(context),
  }), 'git-log-viewer: read-only route')
}

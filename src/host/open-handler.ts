import { spawn } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { RouteError } from './errors.js'
import { admitHeaders, failure, json } from './http.js'
import { resolveRepository } from './repository.js'
import type { RouteContext } from './types.js'
import { launchEditor } from './editors.js'
import { findCodeExecutable, findMacApp } from './vscode.js'

interface OpenBody {
  path?: unknown
  target?: unknown
  /** Editor id for 	arget: 'editor'. */
  editor?: unknown
}

const MAX_BODY_BYTES = 16 * 1024

function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name]
  if (value === undefined) return null
  return Array.isArray(value) ? value.join(', ') : value
}

async function readJson(req: IncomingMessage): Promise<OpenBody> {
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
    return parsed as OpenBody
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

/** Open a terminal, the file manager, or VS Code at `root`; a launch failure is not fatal. */
function launch(target: 'terminal' | 'explorer' | 'vscode', root: string): void {
  if (target === 'vscode') {
    const options = { cwd: root, detached: true, stdio: 'ignore' as const, windowsHide: true }
    let command = 'code'
    let args = ['--new-window', root]
    if (process.platform === 'win32') {
      // Launching the `code.cmd` shim needs cmd.exe, which flashes a console
      // window; the GUI executable opens the window directly.
      const executable = findCodeExecutable()
      if (executable === undefined) {
        command = process.env.ComSpec ?? 'cmd.exe'
        args = ['/c', 'start', '', 'code', '--new-window', root]
      } else {
        command = executable
      }
    } else if (process.platform === 'darwin') {
      // `-a` by name only finds the standard bundle; use the path when found.
      const app = findMacApp()
      command = 'open'
      args = app === undefined ? ['-a', 'Visual Studio Code', root] : ['-a', app, root]
    }
    try {
      const child = spawn(command, args, options)
      child.on('error', () => {})
      child.unref()
    } catch {
      // The editor may not be installed after all; the repository is still there.
    }
    return
  }
  const options = { cwd: root, detached: true, stdio: 'ignore' as const, windowsHide: false }
  let command: string
  let args: string[]
  if (process.platform === 'win32') {
    if (target === 'terminal') {
      command = 'cmd.exe'
      args = ['/c', 'start', '', 'cmd.exe']
    } else {
      command = 'explorer.exe'
      args = [root]
    }
  } else if (process.platform === 'darwin') {
    command = 'open'
    args = target === 'terminal' ? ['-a', 'Terminal', root] : [root]
  } else {
    command = target === 'terminal' ? 'x-terminal-emulator' : 'xdg-open'
    args = target === 'terminal' ? [] : [root]
  }
  try {
    const child = spawn(command, args, options)
    child.on('error', () => {})
    child.unref()
  } catch {
    // The desktop may refuse to open a window; the repository is still there.
  }
}

/** POST /git-suite/open: open a terminal or the file manager at the repository root. */
export function createOpenHandler(context: RouteContext): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (!admitHeaders(name => header(req, name))) {
      await send(res, json({
        ok: false,
        error: { code: 'forbidden', message: 'This request is not allowed to open a folder.' },
      }, 403))
      return
    }
    if (req.method !== 'POST') {
      await send(res, json({
        ok: false,
        error: { code: 'method-not-allowed', message: 'Opening a folder requires POST.' },
      }, 405))
      return
    }

    try {
      const body = await readJson(req)
      const editor = typeof body.editor === 'string' ? body.editor.trim() : ''
      const target = body.target === 'terminal'
        ? 'terminal' as const
        : body.target === 'explorer'
          ? 'explorer' as const
          : body.target === 'vscode'
            ? 'vscode' as const
            : body.target === 'editor' ? 'editor' as const : null
      if (target === null) throw new RouteError(400, 'invalid-target', 'Choose a terminal, the file manager, or an editor.')
      const repo = await resolveRepository(context, typeof body.path === 'string' ? body.path : '')
      if (target === 'editor') {
        if (editor === '') throw new RouteError(400, 'editor-required', 'Choose an editor.')
        if (!(await launchEditor(editor, repo.root))) {
          throw new RouteError(400, 'unknown-editor', 'That editor is not installed on this host.', { editor })
        }
        await send(res, json({ ok: true, target, editor, path: repo.root }))
        return
      }
      launch(target, repo.root)
      await send(res, json({ ok: true, target, path: repo.root }))
    } catch (error) {
      await send(res, failure(error))
    }
  }
}





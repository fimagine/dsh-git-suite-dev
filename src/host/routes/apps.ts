import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { RouteError } from '../errors.js'
import type { AppsPayload } from '../types.js'
import { findCodeExecutable } from '../vscode.js'

const CHECK_TIMEOUT_MS = 5000
const MAC_APP = '/Applications/Visual Studio Code.app'

let cached: Promise<boolean> | null = null

/** Whether VS Code can be launched: the GUI app on Windows/macOS, `code` elsewhere. */
function detectVscode(): Promise<boolean> {
  if (process.platform === 'win32') return Promise.resolve(findCodeExecutable() !== undefined)
  if (process.platform === 'darwin') return Promise.resolve(existsSync(MAC_APP))
  if (cached === null) {
    cached = new Promise<boolean>(resolve => {
      const child = execFile('code', ['--version'], { timeout: CHECK_TIMEOUT_MS, windowsHide: true }, error => {
        resolve(error === null)
      })
      child.on('error', () => resolve(false))
    })
  }
  return cached
}

/** `mode=apps`: which external editors are available for the "open with" actions. */
export async function readApps(): Promise<AppsPayload> {
  try {
    return { ok: true, vscode: await detectVscode() }
  } catch (error) {
    throw new RouteError(500, 'apps-unavailable', 'Could not detect installed editors.', {
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

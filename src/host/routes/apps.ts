import { RouteError } from '../errors.js'
import { installedEditors } from '../editors.js'
import type { AppsPayload } from '../types.js'

/**
 * `mode=apps`: which external editors this host can open the repository in.
 * Detection reads the filesystem (Windows/macOS) or `PATH` (Linux), so an editor
 * installed or removed while the host runs is picked up on the next request.
 */
export async function readApps(): Promise<AppsPayload> {
  try {
    const editors = await installedEditors()
    return {
      ok: true,
      vscode: editors.some(editor => editor.id === 'vscode' || editor.id === 'vscode-insiders'),
      editors: editors.map(editor => ({ id: editor.id, name: editor.name })),
    }
  } catch (error) {
    throw new RouteError(500, 'apps-unavailable', 'Could not detect installed editors.', {
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}



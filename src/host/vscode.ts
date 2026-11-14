import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Windows install locations of the VS Code GUI executable. The `code` command on
 * PATH is a `.cmd` shim, and launching it goes through cmd.exe, which flashes a
 * console window; the GUI executable opens directly and shows nothing.
 */
export function codeExecutableCandidates(): string[] {
  const local = process.env.LOCALAPPDATA
  const programFiles = process.env.ProgramFiles
  const programFilesX86 = process.env['ProgramFiles(x86)']
  const roots = [
    local === undefined ? '' : join(local, 'Programs', 'Microsoft VS Code'),
    programFiles === undefined ? '' : join(programFiles, 'Microsoft VS Code'),
    programFilesX86 === undefined ? '' : join(programFilesX86, 'Microsoft VS Code'),
    local === undefined ? '' : join(local, 'Programs', 'Microsoft VS Code Insiders'),
    programFiles === undefined ? '' : join(programFiles, 'Microsoft VS Code Insiders'),
  ].filter(root => root !== '')
  const candidates: string[] = []
  for (const root of roots) {
    candidates.push(join(root, 'Code.exe'), join(root, 'Code - Insiders.exe'))
  }
  return candidates
}

/** The GUI executable to launch, or `undefined` when VS Code is not installed. */
export function findCodeExecutable(): string | undefined {
  return codeExecutableCandidates().find(candidate => existsSync(candidate))
}

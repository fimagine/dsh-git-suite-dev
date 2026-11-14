import { execFile } from 'node:child_process'

/** One installed program as Windows records it. */
export interface UninstallRecord {
  displayName: string
  /** Often the executable itself (`"C:\...\Code.exe",0`). */
  displayIcon: string | null
  installLocation: string | null
}

export interface RegistryIndex {
  /** Lower-case executable name -> executable path, from `App Paths`. */
  appPaths: Map<string, string>
  uninstalls: UninstallRecord[]
  /** Installer keys that are not covered by App Paths. */
  vendor: {
    androidStudio: string | null
    visualStudio: string | null
  }
}

const APP_PATH_KEYS = [
  'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths',
  'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths',
  'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths',
]

const UNINSTALL_KEYS = [
  'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
]

const VENDOR_KEYS = [
  'HKLM\\SOFTWARE\\Android Studio',
  'HKLM\\SOFTWARE\\WOW6432Node\\Android Studio',
  'HKCU\\SOFTWARE\\Android Studio',
]

const CACHE_MS = 10 * 60 * 1000

function query(key: string, args: readonly string[] = []): Promise<string> {
  return new Promise(resolve => {
    execFile('reg', ['query', key, ...args], { encoding: 'utf8', windowsHide: true, timeout: 15_000 }, (error, stdout) => {
      resolve(error === null ? stdout : '')
    })
  })
}

function unquote(value: string): string {
  return value.trim().replace(/^"+|"+$/g, '')
}

/** `"C:\...\Code.exe",0` -> `C:\...\Code.exe`. */
function iconPath(value: string): string {
  const withoutIndex = unquote(value).replace(/,\s*\d+$/, '')
  return unquote(withoutIndex)
}

export function parseAppPaths(output: string, into: Map<string, string>): void {
  let current: string | null = null
  for (const line of output.split(/\r?\n/)) {
    if (/^HKEY_/i.test(line)) {
      const name = line.slice(line.lastIndexOf('\\') + 1).toLowerCase()
      current = name.endsWith('.exe') ? name : null
      continue
    }
    if (current === null) continue
    const match = /^\s+\(Default\)\s+REG_\w+\s+(.+)$/.exec(line) ?? /^\s+REG_SZ\s+(.+)$/.exec(line)
    if (match?.[1] === undefined) continue
    const path = unquote(match[1])
    if (path.toLowerCase().endsWith('.exe')) into.set(current, path)
    current = null
  }
}

export function parseUninstalls(output: string, into: UninstallRecord[]): void {
  let record: UninstallRecord | null = null
  const flush = (): void => {
    if (record !== null && record.displayName !== '') into.push(record)
    record = null
  }
  for (const line of output.split(/\r?\n/)) {
    if (/^HKEY_/i.test(line)) {
      flush()
      record = { displayName: '', displayIcon: null, installLocation: null }
      continue
    }
    if (record === null) continue
    const match = /^\s+(\w+)\s+REG_\w+\s+(.+)$/.exec(line)
    if (match === null || match[1] === undefined || match[2] === undefined) continue
    const name = match[1].toLowerCase()
    if (name === 'displayname') record.displayName = match[2].trim()
    else if (name === 'displayicon') record.displayIcon = iconPath(match[2])
    else if (name === 'installlocation') record.installLocation = match[2].trim()
  }
  flush()
}

async function vswhere(): Promise<string | null> {
  const roots = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles].filter(
    (root): root is string => root !== undefined && root !== '',
  )
  for (const root of roots) {
    const candidate = `${root}\\Microsoft Visual Studio\\Installer\\vswhere.exe`
    const output = await new Promise<string>(resolve => {
      execFile(
        candidate,
        ['-latest', '-products', '*', '-property', 'productPath'],
        { encoding: 'utf8', windowsHide: true, timeout: 8000 },
        (error, stdout) => resolve(error === null ? stdout.trim() : ''),
      )
    })
    if (output !== '') return output
  }
  return null
}

let cache: { at: number; index: RegistryIndex } | null = null

/**
 * Windows registry view of the installed editors: `App Paths`, the uninstall
 * entries (`DisplayIcon`/`InstallLocation`), and the installer keys that store a
 * custom install root (Android Studio). Cached because the uninstall subtree is
 * large and editors are rarely installed mid-session.
 */
export async function readRegistryIndex(): Promise<RegistryIndex> {
  if (process.platform !== 'win32') {
    return { appPaths: new Map(), uninstalls: [], vendor: { androidStudio: null, visualStudio: null } }
  }
  if (cache !== null && Date.now() - cache.at < CACHE_MS) return cache.index

  const [appPathOutputs, uninstallOutputs, vendorOutputs, visualStudio] = await Promise.all([
    Promise.all(APP_PATH_KEYS.map(key => query(key, ['/s']))),
    Promise.all(UNINSTALL_KEYS.map(key => query(key, ['/s']))),
    Promise.all(VENDOR_KEYS.map(key => query(key, ['/v', 'Path']))),
    vswhere(),
  ])

  const appPaths = new Map<string, string>()
  for (const output of appPathOutputs) parseAppPaths(output, appPaths)
  const uninstalls: UninstallRecord[] = []
  for (const output of uninstallOutputs) parseUninstalls(output, uninstalls)

  let androidStudio: string | null = null
  for (const output of vendorOutputs) {
    const match = /Path\s+REG_SZ\s+(.+)/.exec(output)
    if (match?.[1] !== undefined && match[1].trim() !== '') {
      androidStudio = match[1].trim()
      break
    }
  }

  const index: RegistryIndex = { appPaths, uninstalls, vendor: { androidStudio, visualStudio } }
  cache = { at: Date.now(), index }
  return index
}

/** Test seam: forget the cached registry view. */
export function clearRegistryCache(): void {
  cache = null
}


/**
 * Bundle the client half into the single artifact DSH serves as `exports["./client"]`.
 *
 * DSH loads a client bundle as a lazy factory (`window.__ModuleLoader__.load`);
 * the entry in `src/client/index.tsx` registers that factory, so this build only
 * has to emit one self-contained IIFE. React stays out of the bundle: the factory
 * receives it from the loader's module table at materialization time.
 *
 * Styles are authored in SCSS. This script compiles `styles.scss` and lets
 * esbuild inline the generated CSS as text (`--loader:.css=text`), so the panel
 * can mount the stylesheet with the component.
 *
 * The esbuild CLI is used instead of its Node API so the build also runs where
 * the process sandbox forbids the API service's piped stdio.
 */
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, watchFile, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as sass from 'sass'

const root = fileURLToPath(new URL('..', import.meta.url))
const cli = join(root, 'node_modules', 'esbuild', 'bin', 'esbuild')
const scssFile = join(root, 'src', 'client', 'styles.scss')
const cssFile = join(root, 'src', 'client', 'styles.generated.css')
const watch = process.argv.includes('--watch')
const packageVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version

function compileStyles() {
  const result = sass.compile(scssFile, {
    style: 'expanded',
    loadPaths: [join(root, 'src', 'client')],
  })
  writeFileSync(cssFile, `${result.css.trim()}\n`)
}

const args = [
  'src/client/index.tsx',
  '--bundle',
  '--format=iife',
  '--platform=browser',
  '--target=chrome120',
  '--jsx=transform',
  '--jsx-factory=h',
  '--loader:.css=text',
  // Lets the settings dialog show the installed version without a request.
  `--define:__GIT_SUITE_VERSION__=${JSON.stringify(packageVersion)}`,
  '--sourcemap',
  '--legal-comments=none',
  '--outfile=dist/client.js',
]

// `forever` keeps the watcher alive even when stdin is not a TTY (background runs).
if (watch) args.push('--watch=forever')

try {
  compileStyles()
} catch (error) {
  console.error(`sass: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

if (watch) {
  // esbuild watches the generated file; recompiling it triggers the rebuild.
  watchFile(scssFile, { interval: 300 }, () => {
    try {
      compileStyles()
      console.log('sass: recompiled styles.generated.css')
    } catch (error) {
      console.error(`sass: ${error instanceof Error ? error.message : String(error)}`)
    }
  })
  const child = spawn(process.execPath, [cli, ...args], { cwd: root, stdio: 'inherit' })
  child.on('error', (error) => {
    console.error(error)
    process.exit(1)
  })
  child.on('exit', code => process.exit(code ?? 0))
} else {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, stdio: 'inherit' })
  if (result.error !== undefined) throw result.error
  process.exit(result.status ?? 1)
}

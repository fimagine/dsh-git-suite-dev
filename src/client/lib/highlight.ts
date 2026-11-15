import Prism from 'prismjs'
import 'prismjs/components/prism-markup-templating'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-kotlin'
import 'prismjs/components/prism-swift'
import 'prismjs/components/prism-csharp'
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-php'
import 'prismjs/components/prism-ruby'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-scss'
import 'prismjs/components/prism-less'
import 'prismjs/components/prism-toml'
import 'prismjs/components/prism-ini'
import 'prismjs/components/prism-docker'
import 'prismjs/components/prism-makefile'
import 'prismjs/components/prism-diff'
import 'prismjs/components/prism-cmake'

// The panel tokenizes on demand; never let Prism scan the page on its own.
Prism.manual = true

/** One highlighted run inside a diff line. `type` null means plain text. */
export interface HighlightToken {
  type: string | null
  text: string
}

/** Patches larger than this are rendered plain, to keep scrolling responsive. */
const MAX_LINES = 6000

const BY_EXTENSION: Record<string, string> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  json: 'json',
  jsonc: 'json',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'markup',
  htm: 'markup',
  xml: 'markup',
  svg: 'markup',
  vue: 'markup',
  svelte: 'markup',
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'markdown',
  py: 'python',
  pyi: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  swift: 'swift',
  cs: 'csharp',
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  php: 'php',
  rb: 'ruby',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  cfg: 'ini',
  conf: 'ini',
  sql: 'sql',
  diff: 'diff',
  patch: 'diff',
  dockerfile: 'docker',
  mk: 'makefile',
}

const BY_FILENAME: Record<string, string> = {
  dockerfile: 'docker',
  makefile: 'makefile',
  'cmakelists.txt': 'cmake',
  gemfile: 'ruby',
  rakefile: 'ruby',
}

/** Prism grammar for a repository-relative path, or null when it is unknown. */
export function languageForPath(path: string | null | undefined): string | null {
  if (path === null || path === undefined) return null
  const name = path.split(/[\\/]/).pop() ?? ''
  if (name === '') return null
  const byName = BY_FILENAME[name.toLowerCase()]
  if (byName !== undefined) return byName
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : ''
  if (extension === '') return null
  return BY_EXTENSION[extension] ?? null
}

function walk(tokens: Prism.TokenStream | string, type: string | null, out: HighlightToken[]): void {
  if (typeof tokens === 'string') {
    if (tokens !== '') out.push({ type, text: tokens })
    return
  }
  if (Array.isArray(tokens)) {
    for (const token of tokens) walk(token, type, out)
    return
  }
  const token = tokens as Prism.Token
  walk(token.content as Prism.TokenStream, token.type, out)
}

/**
 * Tokenize one side of a patch (its full text, so multi-line constructs such as
 * block comments highlight correctly) and split the result back into lines.
 */
export function highlightLines(lines: readonly string[], language: string | null): HighlightToken[][] | null {
  if (language === null) return null
  const grammar = Prism.languages[language]
  if (grammar === undefined) return null
  if (lines.length === 0 || lines.length > MAX_LINES) return null

  const flat: HighlightToken[] = []
  try {
    walk(Prism.tokenize(lines.join('\n'), grammar) as Prism.TokenStream, null, flat)
  } catch {
    return null
  }

  const out: HighlightToken[][] = []
  let current: HighlightToken[] = []
  for (const token of flat) {
    const parts = token.text.split('\n')
    for (let index = 0; index < parts.length; index += 1) {
      if (index > 0) {
        out.push(current)
        current = []
      }
      const part = parts[index]
      if (part !== undefined && part !== '') current.push({ type: token.type, text: part })
    }
  }
  out.push(current)
  return out
}


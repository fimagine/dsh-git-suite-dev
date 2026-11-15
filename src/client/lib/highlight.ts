// Base grammars (json, markup, clike, javascript) must load before components
// that extend them; keep this order when adding more Prism languages.
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
import 'prismjs/components/prism-lua'
import 'prismjs/components/prism-dart'
import 'prismjs/components/prism-scala'
import 'prismjs/components/prism-elixir'
import 'prismjs/components/prism-haskell'
import 'prismjs/components/prism-powershell'
import 'prismjs/components/prism-r'
import 'prismjs/components/prism-perl'
import 'prismjs/components/prism-objectivec'
import 'prismjs/components/prism-groovy'
import 'prismjs/components/prism-clojure'
import 'prismjs/components/prism-coffeescript'
import 'prismjs/components/prism-erlang'
import 'prismjs/components/prism-fsharp'
import 'prismjs/components/prism-julia'
import 'prismjs/components/prism-matlab'
import 'prismjs/components/prism-ocaml'
import 'prismjs/components/prism-pascal'
import 'prismjs/components/prism-protobuf'
import 'prismjs/components/prism-solidity'
import 'prismjs/components/prism-vim'
import 'prismjs/components/prism-wasm'
import 'prismjs/components/prism-zig'
import 'prismjs/components/prism-batch'
import 'prismjs/components/prism-json5'
import 'prismjs/components/prism-latex'
import 'prismjs/components/prism-graphql'
import 'prismjs/components/prism-nginx'
import 'prismjs/components/prism-apacheconf'
import 'prismjs/components/prism-properties'
import 'prismjs/components/prism-csv'
import 'prismjs/components/prism-regex'
import 'prismjs/components/prism-git'
import 'prismjs/components/prism-http'
import 'prismjs/components/prism-nix'
import 'prismjs/components/prism-hcl'

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
  lua: 'lua',
  dart: 'dart',
  scala: 'scala',
  sc: 'scala',
  ex: 'elixir',
  exs: 'elixir',
  hs: 'haskell',
  lhs: 'haskell',
  ps1: 'powershell',
  psm1: 'powershell',
  r: 'r',
  pl: 'perl',
  pm: 'perl',
  m: 'objectivec',
  mm: 'objectivec',
  groovy: 'groovy',
  gradle: 'groovy',
  clj: 'clojure',
  cljs: 'clojure',
  cljc: 'clojure',
  edn: 'clojure',
  coffee: 'coffeescript',
  erl: 'erlang',
  hrl: 'erlang',
  fs: 'fsharp',
  fsx: 'fsharp',
  jl: 'julia',
  ml: 'ocaml',
  mli: 'ocaml',
  pas: 'pascal',
  proto: 'protobuf',
  sol: 'solidity',
  vim: 'vim',
  wat: 'wasm',
  zig: 'zig',
  bat: 'batch',
  cmd: 'batch',
  json5: 'json5',
  tex: 'latex',
  graphql: 'graphql',
  gql: 'graphql',
  properties: 'properties',
  csv: 'csv',
  http: 'http',
  rest: 'http',
  nix: 'nix',
  hcl: 'hcl',
  tf: 'hcl',
}

const BY_FILENAME: Record<string, string> = {
  dockerfile: 'docker',
  makefile: 'makefile',
  'cmakelists.txt': 'cmake',
  gemfile: 'ruby',
  rakefile: 'ruby',
  'nginx.conf': 'nginx',
  '.gitignore': 'git',
  '.gitattributes': 'git',
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

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  pwsh: 'powershell',
  ps: 'powershell',
  ps1: 'powershell',
  yml: 'yaml',
  md: 'markdown',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  kt: 'kotlin',
  cs: 'csharp',
  'c#': 'csharp',
  'c++': 'cpp',
  objc: 'objectivec',
  'objective-c': 'objectivec',
  golang: 'go',
  fs: 'fsharp',
  'f#': 'fsharp',
  htm: 'markup',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  vue: 'markup',
  svelte: 'markup',
  dockerfile: 'docker',
  make: 'makefile',
  ex: 'elixir',
  erl: 'erlang',
  hs: 'haskell',
  clj: 'clojure',
  coffee: 'coffeescript',
  proto: 'protobuf',
  sol: 'solidity',
  tex: 'latex',
  gql: 'graphql',
  terraform: 'hcl',
  bat: 'batch',
  cmd: 'batch',
  wat: 'wasm',
  ml: 'ocaml',
  pas: 'pascal',
  patch: 'diff',
}

/** Prism grammar for a fenced-code language name, or null when it is unknown. */
export function languageForAlias(alias: string): string | null {
  const key = alias.trim().toLowerCase()
  if (key === '') return null
  const language = LANGUAGE_ALIASES[key] ?? key
  return Prism.languages[language] === undefined ? null : language
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


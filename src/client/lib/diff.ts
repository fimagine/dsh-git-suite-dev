/** One rendered line of a unified diff. */
export type DiffLineKind = 'meta' | 'file' | 'hunk' | 'add' | 'del' | 'context' | 'note'

export interface DiffLine {
  /** Position of this line inside the parsed patch. */
  index: number
  kind: DiffLineKind
  /** The line exactly as git printed it, including the `+`, `-`, or space marker. */
  raw: string
  /** The line without its marker (empty for headers). */
  content: string
  /** Old-file line number, when the line exists on that side. */
  oldLine: number | null
  /** New-file line number, when the line exists on that side. */
  newLine: number | null
  /** Index of the hunk this line belongs to; -1 before the first hunk. */
  hunk: number
}

export interface ParsedDiff {
  lines: DiffLine[]
  additions: number
  deletions: number
}

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

const FILE_PREFIXES = [
  'diff --git ',
  'index ',
  'new file mode ',
  'deleted file mode ',
  'old mode ',
  'new mode ',
  'similarity index ',
  'dissimilarity index ',
  'rename from ',
  'rename to ',
  'copy from ',
  'copy to ',
  '--- ',
  '+++ ',
  'Binary files ',
]

function number(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Split a unified diff into typed lines with old/new line numbers, so the view
 * can colour additions and deletions and show a two-column gutter.
 */
export function parseDiff(patch: string): ParsedDiff {
  const lines: DiffLine[] = []
  let oldLine = 0
  let newLine = 0
  let hunk = -1
  let additions = 0
  let deletions = 0

  for (const raw of patch.split(/\r?\n/)) {
    const index = lines.length
    if (FILE_PREFIXES.some(prefix => raw.startsWith(prefix))) {
      lines.push({ index, kind: 'file', raw, content: raw, oldLine: null, newLine: null, hunk })
      continue
    }
    const header = HUNK.exec(raw)
    if (header !== null) {
      hunk += 1
      oldLine = number(header[1])
      newLine = number(header[3])
      lines.push({ index, kind: 'hunk', raw, content: raw, oldLine: null, newLine: null, hunk })
      continue
    }
    if (raw.startsWith('\\')) {
      lines.push({ index, kind: 'note', raw, content: raw, oldLine: null, newLine: null, hunk })
      continue
    }
    if (raw.startsWith('+')) {
      additions += 1
      lines.push({ index, kind: 'add', raw, content: raw.slice(1), oldLine: null, newLine, hunk })
      newLine += 1
      continue
    }
    if (raw.startsWith('-')) {
      deletions += 1
      lines.push({ index, kind: 'del', raw, content: raw.slice(1), oldLine, newLine: null, hunk })
      oldLine += 1
      continue
    }
    if (raw.startsWith(' ')) {
      lines.push({ index, kind: 'context', raw, content: raw.slice(1), oldLine, newLine, hunk })
      oldLine += 1
      newLine += 1
      continue
    }
    lines.push({ index, kind: 'meta', raw, content: raw, oldLine: null, newLine: null, hunk })
  }

  // A trailing newline in the patch produces one empty trailing line.
  while (lines.length > 0) {
    const last = lines[lines.length - 1]
    if (last === undefined || last.kind !== 'meta' || last.raw !== '') break
    lines.pop()
  }
  return { lines, additions, deletions }
}


/** One side-by-side row: a deletion (left) paired with an addition (right). */
export interface DiffSplitRow {
  /** Full-width row (file header, hunk header, note) when set. */
  full: DiffLine | null
  left: DiffLine | null
  right: DiffLine | null
}

/**
 * Pair a unified diff into side-by-side rows: consecutive deletions and
 * additions line up index-wise, context lines appear on both sides, and
 * headers keep their own full-width row.
 */
export function pairDiffLines(lines: readonly DiffLine[]): DiffSplitRow[] {
  const rows: DiffSplitRow[] = []
  let deletions: DiffLine[] = []
  let additions: DiffLine[] = []

  const flush = (): void => {
    const count = Math.max(deletions.length, additions.length)
    for (let index = 0; index < count; index += 1) {
      rows.push({ full: null, left: deletions[index] ?? null, right: additions[index] ?? null })
    }
    deletions = []
    additions = []
  }

  for (const line of lines) {
    switch (line.kind) {
      case 'del':
        deletions.push(line)
        break
      case 'add':
        additions.push(line)
        break
      case 'context':
        flush()
        rows.push({ full: null, left: line, right: line })
        break
      default:
        flush()
        rows.push({ full: line, left: null, right: null })
        break
    }
  }
  flush()
  return rows
}


/** Whether a line can be selected (and staged on its own). */
export function isContentLine(line: DiffLine | null): line is DiffLine {
  return line !== null && (line.kind === 'add' || line.kind === 'del' || line.kind === 'context')
}

/**
 * Map a rendered row range onto the patch lines it covers. Unified rows are
 * patch lines; a split row pairs one old line with one new line, so the result
 * lists exactly those indexes instead of the range between them.
 */
export function patchLinesForRows(
  rows: readonly DiffSplitRow[] | null,
  lines: readonly DiffLine[],
  start: number,
  end: number,
): { start: number; end: number; lines: number[] } | null {
  const picked: number[] = []
  if (rows === null) {
    for (let row = start; row <= end; row += 1) {
      const line = lines[row]
      if (line !== undefined && isContentLine(line)) picked.push(line.index)
    }
  } else {
    for (let row = start; row <= end; row += 1) {
      const entry = rows[row]
      if (entry === undefined) continue
      for (const line of [entry.left, entry.right]) {
        if (isContentLine(line)) picked.push(line.index)
      }
    }
  }
  if (picked.length === 0) return null
  const unique = [...new Set(picked)].sort((a, b) => a - b)
  return { start: unique[0] ?? 0, end: unique[unique.length - 1] ?? 0, lines: unique }
}

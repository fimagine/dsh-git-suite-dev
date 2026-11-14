export interface DiffHunk {
  /** Zero-based position of the hunk inside the patch. */
  index: number
  /** The `@@ -a,b +c,d @@` line. */
  header: string
  /** Body lines, including the trailing context lines git prints. */
  lines: string[]
}

export interface SplitPatch {
  /** File header lines before the first hunk (diff/index/---/+++ and mode lines). */
  header: string[]
  hunks: DiffHunk[]
}

/** Split one file's unified diff into its header and its hunks. */
export function splitHunks(patch: string): SplitPatch {
  const header: string[] = []
  const hunks: DiffHunk[] = []
  let current: DiffHunk | null = null
  for (const line of patch.split(/\r?\n/)) {
    if (line.startsWith('@@')) {
      current = { index: hunks.length, header: line, lines: [] }
      hunks.push(current)
      continue
    }
    if (current === null) {
      if (line !== '') header.push(line)
      continue
    }
    current.lines.push(line)
  }
  // A patch split on newlines leaves one empty trailing line in the last hunk.
  const last = hunks[hunks.length - 1]
  if (last !== undefined && last.lines[last.lines.length - 1] === '') last.lines.pop()
  return { header, hunks }
}

/**
 * Build a patch that contains only the selected hunks, keeping the original
 * file header. git apply locates each hunk by its context, so the skipped
 * hunks do not need their line numbers rewritten.
 */
export function selectHunks(patch: string, indexes: readonly number[]): string | null {
  const { header, hunks } = splitHunks(patch)
  const chosen = hunks.filter(hunk => indexes.includes(hunk.index))
  if (chosen.length === 0) return null
  const lines = [...header]
  for (const hunk of chosen) lines.push(hunk.header, ...hunk.lines)
  return `${lines.join('\n')}\n`
}

interface LineRun {
  startOld: number
  startNew: number
  oldCount: number
  newCount: number
  lines: string[]
}

/**
 * Build a patch containing only the selected lines of one file's diff. Selected
 * additions stay additions, selected deletions stay deletions, and every other
 * line is left out; each contiguous run becomes its own hunk with recomputed
 * counts, which `git apply --recount --unidiff-zero` accepts.
 */
export function buildLinePatch(diff: string, selected: readonly number[]): string | null {
  if (selected.length === 0) return null
  const lines = diff.split(/\r?\n/)
  const firstHunk = lines.findIndex(line => line.startsWith('@@'))
  if (firstHunk < 0) return null
  const header = lines.slice(0, firstHunk)
  const chosen = new Set(selected)
  const hunks: string[] = []

  let index = firstHunk
  while (index < lines.length) {
    if (!lines[index]?.startsWith('@@')) {
      index += 1
      continue
    }
    const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(lines[index] ?? '')
    let oldCursor = Number(match?.[1] ?? 0)
    let newCursor = Number(match?.[2] ?? 0)
    let run: LineRun | null = null
    const flush = (): void => {
      if (run === null) return
      hunks.push(`@@ -${run.startOld},${run.oldCount} +${run.startNew},${run.newCount} @@`)
      for (const line of run.lines) hunks.push(line)
      run = null
    }
    index += 1
    while (index < lines.length) {
      const raw = lines[index] ?? ''
      if (raw.startsWith('@@') || raw.startsWith('diff --git')) break
      const marker = raw.slice(0, 1)
      if (marker === '\\') {
        index += 1
        continue
      }
      if (chosen.has(index)) {
        if (run === null) {
          run = {
            startOld: marker === '+' ? oldCursor - 1 : oldCursor,
            startNew: newCursor,
            oldCount: 0,
            newCount: 0,
            lines: [],
          }
        }
        run.lines.push(raw)
        if (marker === '-' || marker === ' ') run.oldCount += 1
        if (marker === '+' || marker === ' ') run.newCount += 1
      } else {
        flush()
      }
      if (marker === '+') newCursor += 1
      else if (marker === '-') oldCursor += 1
      else if (marker === ' ') {
        oldCursor += 1
        newCursor += 1
      }
      index += 1
    }
    flush()
  }

  if (hunks.length === 0) return null
  return `${[...header, ...hunks].join('\n')}\n`
}

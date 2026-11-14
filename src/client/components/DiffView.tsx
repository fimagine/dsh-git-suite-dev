import type * as React from 'react'
import { h, useEffect, useMemo, useRef, useState } from '../runtime.js'
import { pairDiffLines, parseDiff } from '../lib/diff.js'
import type { Translate } from '../types.js'

export type DiffMode = 'unified' | 'split'

export interface DiffHunkAction {
  label: string
  busy?: boolean
  /** Called with the hunk index inside this patch. */
  onAction(hunk: number): void
}

export interface DiffSelection {
  /** First selected row index inside the parsed lines. */
  start: number
  /** Last selected row index, inclusive. */
  end: number
}

export interface DiffViewProps {
  /** Unified diff text (`git diff`, `git show`, or one file's section). */
  patch: string
  t: Translate
  /** Message shown when the patch has no lines. */
  empty?: string
  /** Lines rendered before the "show more" button appears. */
  pageSize?: number
  /** Unified rows or a side-by-side split. */
  mode?: DiffMode
  /** Optional per-hunk action, e.g. "stage this hunk". */
  hunkAction?: DiffHunkAction
  /** Reports the selected row range, if the caller wants to act on it. */
  onSelectLines?(selection: DiffSelection | null): void
  /** Right-click inside the selection (or on one row) with the rows to act on. */
  onLineContextMenu?(selection: DiffSelection, event: React.MouseEvent): void
  className?: string
}

const DEFAULT_PAGE = 800
const EDGE = 24

/**
 * Unified or side-by-side diff renderer: coloured additions and deletions, a
 * sticky old/new gutter (unified mode), incremental rendering for huge patches,
 * gutter drag selection, and per-hunk actions.
 */
export function DiffView({
  patch,
  t,
  empty,
  pageSize = DEFAULT_PAGE,
  mode = 'unified',
  hunkAction,
  onSelectLines,
  onLineContextMenu,
  className,
}: DiffViewProps): React.ReactElement {
  const parsed = useMemo(() => parseDiff(patch), [patch])
  const splitRows = useMemo(() => (mode === 'split' ? pairDiffLines(parsed.lines) : null), [mode, parsed.lines])
  const [limit, setLimit] = useState(pageSize)
  const [anchor, setAnchor] = useState<number | null>(null)
  const [head, setHead] = useState<number | null>(null)
  const [selecting, setSelecting] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setLimit(pageSize)
    setAnchor(null)
    setHead(null)
  }, [patch, mode, pageSize])

  // Drag across the gutter picks up the row under the pointer.
  useEffect(() => {
    if (!selecting) return undefined
    const rowUnder = (clientX: number, clientY: number): number | null => {
      const element = document.elementFromPoint(clientX, clientY)
      const row = element?.closest<HTMLElement>('[data-diff-row]')
      if (row === null || row === undefined) return null
      const value = Number.parseInt(row.dataset.diffRow ?? '', 10)
      return Number.isFinite(value) ? value : null
    }
    const onMove = (event: PointerEvent): void => {
      const next = rowUnder(event.clientX, event.clientY)
      if (next !== null) setHead(next)
      // Scroll while dragging past the top or bottom edge.
      const container = containerRef.current
      if (container === null) return
      const rect = container.getBoundingClientRect()
      if (event.clientY < rect.top + EDGE) container.scrollTop -= 14
      else if (event.clientY > rect.bottom - EDGE) container.scrollTop += 14
    }
    const onUp = (): void => setSelecting(false)
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
    }
  }, [selecting])

  const unified = splitRows === null
  const range = unified && anchor !== null && head !== null
    ? { start: Math.min(anchor, head), end: Math.max(anchor, head) }
    : null

  useEffect(() => {
    onSelectLines?.(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the range matters
  }, [range?.start, range?.end])

  if (parsed.lines.length === 0) {
    return <p className="dsh-gitlog-note">{empty ?? t('fileNoPatch')}</p>
  }

  const totalRows = splitRows === null ? parsed.lines.length : splitRows.length
  const remaining = totalRows - Math.min(limit, totalRows)

  const copySelection = (): void => {
    if (range === null) return
    const text = parsed.lines
      .slice(range.start, range.end + 1)
      .map(line => line.raw)
      .join('\n')
    void navigator.clipboard?.writeText(text).catch(() => {})
  }

  const hunkButton = (hunk: number): React.ReactElement | null => hunkAction === undefined
    ? null
    : (
        <button
          type="button"
          className="dsh-gitlog-diff-hunk-action"
          disabled={hunkAction.busy === true}
          onClick={() => hunkAction.onAction(hunk)}
        >
          {hunkAction.label}
        </button>
      )

  const unifiedLine = (line: typeof parsed.lines[number], index: number): React.ReactElement => {
    const selected = range !== null && index >= range.start && index <= range.end
    return (
      <div
        key={index}
        data-diff-row={index}
        className={`dsh-gitlog-diff-line is-${line.kind}${selected ? ' is-selected' : ''}`}
        onContextMenu={event => {
          if (onLineContextMenu === undefined) return
          event.preventDefault()
          const inside = range !== null && index >= range.start && index <= range.end
          if (!inside) {
            setAnchor(index)
            setHead(index)
          }
          onLineContextMenu(inside && range !== null ? range : { start: index, end: index }, event)
        }}
      >
        <span
          className="dsh-gitlog-diff-gutter"
          onPointerDown={event => {
            if (event.button !== 0) return
            event.preventDefault()
            containerRef.current?.focus()
            setAnchor(index)
            setHead(index)
            setSelecting(true)
          }}
        >
          <span className="dsh-gitlog-diff-num">{line.oldLine ?? ''}</span>
          <span className="dsh-gitlog-diff-num">{line.newLine ?? ''}</span>
        </span>
        <span className="dsh-gitlog-diff-code">{line.raw === '' ? ' ' : line.raw}</span>
        {line.kind === 'hunk' ? hunkButton(line.hunk) : null}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`dsh-gitlog-diff${unified ? '' : ' is-split'}${className === undefined ? '' : ` ${className}`}`}
      role="region"
      aria-label={t('patch')}
      tabIndex={0}
      onPointerDown={event => {
        // A click outside the gutter drops the line selection.
        const target = event.target as HTMLElement | null
        if (target !== null && target.closest('.dsh-gitlog-diff-gutter') !== null) return
        setAnchor(null)
        setHead(null)
      }}
      onKeyDown={event => {
        if (range === null) return
        if (event.key !== 'c' || !(event.ctrlKey || event.metaKey)) return
        event.preventDefault()
        copySelection()
      }}
    >
      {splitRows === null
        ? parsed.lines.slice(0, limit).map(unifiedLine)
        : splitRows.slice(0, limit).map((row, index) => {
            if (row.full !== null) {
              return (
                <div key={index} className={`dsh-gitlog-diff-line is-${row.full.kind}`}>
                  <span className="dsh-gitlog-diff-code">{row.full.raw === '' ? ' ' : row.full.raw}</span>
                  {row.full.kind === 'hunk' ? hunkButton(row.full.hunk) : null}
                </div>
              )
            }
            const cell = (line: typeof row.left, side: 'left' | 'right'): React.ReactElement => (
              <div className={`dsh-gitlog-diff-cell${line === null ? ' is-empty' : ` is-${line.kind}`}`}>
                <span className="dsh-gitlog-diff-num">
                  {line === null ? '' : side === 'left' ? line.oldLine ?? '' : line.newLine ?? ''}
                </span>
                <span className="dsh-gitlog-diff-code">{line === null ? '' : line.raw}</span>
              </div>
            )
            return (
              <div key={index} className="dsh-gitlog-diff-split-row">
                {cell(row.left, 'left')}
                {cell(row.right, 'right')}
              </div>
            )
          })}
      {remaining > 0
        ? (
            <button
              type="button"
              className="dsh-gitlog-diff-more"
              onClick={() => setLimit(value => value + pageSize)}
            >
              {t('diffMore').replace('{count}', String(remaining))}
            </button>
          )
        : null}
    </div>
  )
}

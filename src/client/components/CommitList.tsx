import type * as React from 'react'
import { h, useEffect, useRef, useState } from '../runtime.js'
import type { GitLogView } from '../hooks/useGitLogView.js'
import { graphGeometry } from '../lib/graph.js'
import type { Commit, Translate } from '../types.js'
import { CommitRow, COMMIT_ROW_HEIGHT } from './CommitRow.js'
import { Dropdown, type DropdownOption } from './Dropdown.js'
import { LoadingLine } from './States.js'

interface ColumnWidths {
  graph: number
  date: number
  author: number
  hash: number
}

const DEFAULT_COLUMN_WIDTHS: ColumnWidths = { graph: 48, date: 88, author: 110, hash: 64 }
const COLUMN_LIMITS: Record<keyof ColumnWidths, readonly [number, number]> = {
  graph: [32, Number.POSITIVE_INFINITY],
  date: [56, Number.POSITIVE_INFINITY],
  author: [64, Number.POSITIVE_INFINITY],
  hash: [48, Number.POSITIVE_INFINITY],
}
const COLUMN_KEYS = ['graph', 'date', 'author', 'hash'] as const
const COLUMN_STORAGE_KEY = 'dsh.git-suite.commit-columns.v1'
const COLUMN_PADDING = 26
const COLUMN_GAPS = 32
const MIN_DESCRIPTION_WIDTH = 120
const OVERSCAN_ROWS = 6
const INITIAL_RENDERED_ROWS = 40
const AUTO_LOAD_ROWS = 5

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function readColumnWidths(): ColumnWidths {
  try {
    const raw = window.localStorage.getItem(COLUMN_STORAGE_KEY)
    if (raw === null) return { ...DEFAULT_COLUMN_WIDTHS }
    const parsed = JSON.parse(raw) as Partial<Record<keyof ColumnWidths, unknown>>
    const widths = { ...DEFAULT_COLUMN_WIDTHS }
    for (const key of COLUMN_KEYS) {
      const value = parsed[key]
      if (typeof value === 'number' && Number.isFinite(value)) {
        const [min, max] = COLUMN_LIMITS[key]
        widths[key] = clamp(value, min, max)
      }
    }
    return widths
  } catch {
    return { ...DEFAULT_COLUMN_WIDTHS }
  }
}

interface ColumnResizerProps {
  label: string
  style: React.CSSProperties
  onStart(): void
  onDrag(deltaX: number): void
}

/** A vertical drag handle placed in a header gap; it only reports pointer deltas. */
function ColumnResizer({ label, style, onStart, onDrag }: ColumnResizerProps): React.ReactElement {
  const [dragging, setDragging] = useState(false)
  const origin = useRef<number | null>(null)

  const stop = (element: Element, pointerId: number): void => {
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId)
    document.documentElement.style.cursor = ''
    document.body.style.userSelect = ''
    origin.current = null
    setDragging(false)
  }

  return (
    <span
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation="vertical"
      title={label}
      className={`dsh-gitlog-col-resizer${dragging ? ' is-dragging' : ''}`}
      style={style}
      onPointerDown={event => {
        if (event.button !== 0) return
        event.preventDefault()
        origin.current = event.clientX
        setDragging(true)
        event.currentTarget.setPointerCapture(event.pointerId)
        document.documentElement.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
        onStart()
      }}
      onPointerMove={event => {
        if (origin.current === null) return
        onDrag(event.clientX - origin.current)
      }}
      onPointerUp={event => {
        if (origin.current === null) return
        stop(event.currentTarget, event.pointerId)
      }}
      onPointerCancel={event => {
        if (origin.current === null) return
        stop(event.currentTarget, event.pointerId)
      }}
      onKeyDown={event => {
        const step = event.shiftKey ? 32 : 8
        let delta = 0
        if (event.key === 'ArrowLeft') delta = -step
        else if (event.key === 'ArrowRight') delta = step
        if (delta === 0) return
        event.preventDefault()
        onStart()
        onDrag(delta)
      }}
    />
  )
}

/** The paged, virtualized commit list with a sticky table header and resizable columns. */
export function CommitList({ view, t, onContextMenu }: {
  view: GitLogView
  t: Translate
  onContextMenu?(commit: Commit, event: React.MouseEvent): void
}): React.ReactElement {
  const { commits, selected, graph, status, hasMore } = view
  const listRef = useRef<HTMLElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const [widths, setWidths] = useState<ColumnWidths>(readColumnWidths)
  const [range, setRange] = useState({ start: 0, end: Math.min(commits.length, INITIAL_RENDERED_ROWS) })
  const startWidths = useRef<ColumnWidths>(widths)
  const loadMoreRef = useRef(view.loadMore)
  loadMoreRef.current = view.loadMore

  useEffect(() => {
    try {
      window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(widths))
    } catch {
      // Storage can be disabled; resizing still works for this session.
    }
  }, [widths])

  useEffect(() => {
    const list = listRef.current
    if (list === null) return undefined
    const check = (): void => {
      if (!hasMore || status === 'loading') return
      const distance = list.scrollHeight - list.scrollTop - list.clientHeight
      if (distance <= COMMIT_ROW_HEIGHT * AUTO_LOAD_ROWS) loadMoreRef.current()
    }
    const onScroll = (): void => {
      check()
    }
    list.addEventListener('scroll', onScroll, { passive: true })
    const observer = new ResizeObserver(check)
    observer.observe(list)
    check()
    return () => {
      list.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [hasMore, status, commits.length])

  useEffect(() => {
    const list = listRef.current
    if (list === null) return undefined
    const update = (): void => {
      const headerHeight = headerRef.current?.offsetHeight ?? 0
      const visibleHeight = Math.max(0, list.clientHeight - headerHeight)
      const start = Math.min(commits.length, Math.max(0, Math.floor(list.scrollTop / COMMIT_ROW_HEIGHT) - OVERSCAN_ROWS))
      const end = Math.min(commits.length, Math.ceil((list.scrollTop + visibleHeight) / COMMIT_ROW_HEIGHT) + OVERSCAN_ROWS)
      setRange(previous => previous.start === start && previous.end === end
        ? previous
        : { start, end: Math.max(start, end) })
    }
    const onScroll = (): void => {
      update()
    }
    update()
    list.addEventListener('scroll', onScroll, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(list)
    const header = headerRef.current
    if (header !== null) observer.observe(header)
    return () => {
      list.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [commits.length])

  const geometry = graphGeometry(graph.maxLanes)
  const visible = commits
    .slice(range.start, range.end)
    .map((commit, offset) => ({ commit, index: range.start + offset }))

  const beginResize = (): void => {
    startWidths.current = widths
  }

  const resizeColumn = (key: 'date' | 'author' | 'hash', deltaX: number): void => {
    setWidths(current => {
      const start = startWidths.current
      const [min] = COLUMN_LIMITS[key]
      // No max width: wide columns are allowed to make the table scroll
      // horizontally, while the description keeps its 120px minimum.
      const next = Math.max(min, start[key] - deltaX)
      if (next === current[key]) return current
      return { ...current, [key]: next }
    })
  }

  const resizeGraph = (deltaX: number): void => {
    setWidths(current => {
      const start = startWidths.current
      const [min] = COLUMN_LIMITS.graph
      const next = Math.max(min, start.graph + deltaX)
      if (next === current.graph) return current
      return { ...current, graph: next }
    })
  }

  const style = {
    '--gitlog-graph-w': `${widths.graph}px`,
    '--gitlog-date-w': `${widths.date}px`,
    '--gitlog-author-w': `${widths.author}px`,
    '--gitlog-hash-w': `${widths.hash}px`,
    '--gitlog-table-min': `calc(${widths.graph}px + ${widths.date}px + ${widths.author}px + ${widths.hash}px + ${COLUMN_PADDING + COLUMN_GAPS + MIN_DESCRIPTION_WIDTH}px)`,
  } as React.CSSProperties

  // Each resizer sits in the 8px grid gap at the boundary it moves.
  const graphResizerLeft = 'calc(10px + var(--gitlog-graph-w))'
  const dateResizerRight = 'calc(16px + var(--gitlog-hash-w) + 8px + var(--gitlog-author-w) + 8px + var(--gitlog-date-w))'
  const authorResizerRight = 'calc(16px + var(--gitlog-hash-w) + 8px + var(--gitlog-author-w))'
  const hashResizerRight = 'calc(16px + var(--gitlog-hash-w))'

  const localBranches = view.tree?.branches ?? []
  const remoteGroups = view.tree?.remotes ?? []
  const branchOptions: DropdownOption[] = [
    { value: 'all', label: t('allBranches') },
    { value: 'head', label: t('currentBranch') },
    ...localBranches.map(branch => ({
      value: `branch:${branch.ref}`,
      label: branch.name,
      title: branch.name,
    })),
    ...(view.showRemotes
      ? remoteGroups.flatMap(group => group.branches.map(branch => ({
          value: `branch:${branch.ref}`,
          label: branch.name,
          title: branch.name,
          group: group.name,
        })))
      : []),
  ]
  const branchValue = view.selection.kind === 'all'
    ? 'all'
    : view.selection.kind === 'head'
      ? 'head'
      : view.selection.kind === 'branch'
        ? `branch:${view.selection.ref}`
        : ''
  const chooseBranch = (value: string): void => {
    if (value === 'all') {
      view.selectRef({ kind: 'all' })
      return
    }
    if (value === 'head') {
      view.selectRef({ kind: 'head' })
      return
    }
    const ref = value.startsWith('branch:') ? value.slice('branch:'.length) : ''
    const local = localBranches.find(branch => branch.ref === ref)
    const remote = remoteGroups.flatMap(group => group.branches).find(branch => branch.ref === ref)
    const branch = local ?? remote
    if (branch === undefined) return
    view.selectRef({ kind: 'branch', ref: branch.ref, name: branch.name, remote: branch.kind === 'remote' })
  }
  const sortOptions: DropdownOption[] = [
    { value: 'date', label: t('sortDate') },
    { value: 'topo', label: t('sortTopo') },
  ]

  return (
    <section ref={listRef} className="dsh-gitlog-list" aria-label={t('commits')} style={style}>
      <div ref={headerRef} className="dsh-gitlog-list-header">
        <div className="dsh-gitlog-history-toolbar">
          <Dropdown
            className="dsh-gitlog-history-branch"
            value={branchValue}
            options={branchOptions}
            onChange={chooseBranch}
            ariaLabel={t('branchFilter')}
            placeholder={view.branchLabel}
          />
          <label className="dsh-gitlog-check dsh-gitlog-history-remotes">
            <input
              type="checkbox"
              checked={view.showRemotes}
              onChange={event => view.setShowRemotes(event.target.checked)}
            />
            {t('showRemoteBranches')}
          </label>
          <Dropdown
            className="dsh-gitlog-history-sort"
            value={view.sort}
            options={sortOptions}
            onChange={value => view.setSort(value === 'topo' ? 'topo' : 'date')}
            ariaLabel={t('sortOrder')}
          />
        </div>
        <div className="dsh-gitlog-list-head">
          <span>{`${commits.length} ${t('commits')}`}</span>
          {view.repo ? <span className="dsh-gitlog-branch" title={view.branchLabel}>{view.branchLabel}</span> : null}
        </div>
        <div className="dsh-gitlog-commit-header">
          <span className="dsh-gitlog-col dsh-gitlog-col-graph">{t('columnGraph')}</span>
          <span className="dsh-gitlog-col dsh-gitlog-col-description">{t('columnDescription')}</span>
          <span className="dsh-gitlog-col dsh-gitlog-col-date">{t('columnDate')}</span>
          <span className="dsh-gitlog-col dsh-gitlog-col-author">{t('columnAuthor')}</span>
          <span className="dsh-gitlog-col dsh-gitlog-col-hash">{t('columnCommit')}</span>
          <ColumnResizer
            label={`${t('resizeColumn')} · ${t('columnGraph')}`}
            style={{ left: graphResizerLeft }}
            onStart={beginResize}
            onDrag={resizeGraph}
          />
          <ColumnResizer
            label={`${t('resizeColumn')} · ${t('columnDate')}`}
            style={{ right: dateResizerRight }}
            onStart={beginResize}
            onDrag={deltaX => resizeColumn('date', deltaX)}
          />
          <ColumnResizer
            label={`${t('resizeColumn')} · ${t('columnAuthor')}`}
            style={{ right: authorResizerRight }}
            onStart={beginResize}
            onDrag={deltaX => resizeColumn('author', deltaX)}
          />
          <ColumnResizer
            label={`${t('resizeColumn')} · ${t('columnCommit')}`}
            style={{ right: hashResizerRight }}
            onStart={beginResize}
            onDrag={deltaX => resizeColumn('hash', deltaX)}
          />
        </div>
      </div>
      <div className="dsh-gitlog-list-body" style={{ height: commits.length * COMMIT_ROW_HEIGHT }}>
        {visible.map(({ commit, index }) => {
          const row = graph.rows[index]
          if (row === undefined) return null
          return (
            <div
              key={commit.hash}
              className="dsh-gitlog-commit-slot"
              style={{ top: index * COMMIT_ROW_HEIGHT }}
            >
              <CommitRow
                commit={commit}
                selected={selected === commit.hash}
                onSelect={view.selectCommit}
                onContextMenu={onContextMenu}
                t={t}
                row={row}
                geometry={geometry}
              />
            </div>
          )
        })}
      </div>
      {status === 'loading' ? <LoadingLine label={t('loadingCommits')} /> : null}
    </section>
  )
}

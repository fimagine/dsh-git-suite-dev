import type * as React from 'react'
import { CommitActions, type CommitContext } from './components/CommitActions.js'
import { CommitList } from './components/CommitList.js'
import { DetailPane } from './components/DetailPane.js'
import { ErrorState } from './components/ErrorState.js'
import { PanelControls } from './components/PanelControls.js'
import { RefsTree } from './components/RefsTree.js'
import { RefreshIcon } from './components/GitLogIcon.js'
import { RepoActions } from './components/RepoActions.js'
import { SettingsDialog, SettingsIcon } from './components/SettingsDialog.js'
import { Splitter } from './components/Splitter.js'
import { WorkspacePane } from './components/WorkspacePane.js'
import { EmptyState, LoadingState } from './components/States.js'
import { useGitLogView } from './hooks/useGitLogView.js'
import { useWorkspace } from './hooks/useWorkspace.js'
import { h, useEffect, useRef, useState } from './runtime.js'
import { CSS } from './styles.js'
import type { Commit, Translate } from './types.js'

export interface GitLogPanelProps {
  t: Translate
  /** Narrow right-sidebar column: start with the refs tree hidden. */
  compact?: boolean
}

const MIN_TREE_WIDTH = 160
const MAX_TREE_WIDTH = 480
const MIN_TREE_HEIGHT = 140
const MAX_TREE_HEIGHT = 460
const MIN_DETAIL_RATIO = 0.2
const MAX_DETAIL_RATIO = 0.8

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** The 900px breakpoint is shared with the stylesheet's single-column layout. */
function isNarrowViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches
}

/** The Git suite panel; the same component backs the main area and the right-sidebar tab. */
export function GitLogPanel({ t, compact = false }: GitLogPanelProps): React.ReactElement {
  const view = useGitLogView(t)
  const { status, commits, error, detail, detailStatus, detailError } = view
  const workspacePath = view.repo?.repoRoot ?? view.pathInput.trim()
  const workspaceRevision = `${workspacePath}:${view.repo?.branch ?? ''}`
  const ws = useWorkspace(workspacePath, workspaceRevision, t, view.refresh)
  const [narrow, setNarrow] = useState(isNarrowViewport)
  const [treeWidth, setTreeWidth] = useState(240)
  const [treeHeight, setTreeHeight] = useState(220)
  const [detailRatio, setDetailRatio] = useState(0.45)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'history' | 'workspace'>('history')
  const [commitMenu, setCommitMenu] = useState<CommitContext | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const stackRef = useRef<HTMLDivElement | null>(null)
  const treeStart = useRef({ width: 240, height: 220, maxWidth: MAX_TREE_WIDTH, maxHeight: MAX_TREE_HEIGHT })
  const detailStart = useRef({ ratio: 0.45, height: 0 })
  const hasCommits = commits.length > 0
  // In the narrow layout the tree sits above the log, so its splitter is horizontal.
  const treeOrientation = compact || narrow ? 'horizontal' : 'vertical'

  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)')
    const update = (): void => setNarrow(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  const state = status === 'loading'
    ? <LoadingState label={t('loadingCommits')} />
    : status === 'error'
      ? <ErrorState error={error} t={t} onRetry={view.refresh} />
      : <EmptyState t={t} onRefresh={view.refresh} />

  const startTreeResize = (): void => {
    const rect = bodyRef.current?.getBoundingClientRect()
    treeStart.current = {
      width: treeWidth,
      height: treeHeight,
      maxWidth: rect === undefined
        ? MAX_TREE_WIDTH
        : clamp(rect.width - 320, MIN_TREE_WIDTH, MAX_TREE_WIDTH),
      maxHeight: rect === undefined
        ? MAX_TREE_HEIGHT
        : clamp(rect.height - 240, MIN_TREE_HEIGHT, MAX_TREE_HEIGHT),
    }
  }

  const resizeTree = (deltaX: number, deltaY: number): void => {
    if (treeOrientation === 'vertical') {
      setTreeWidth(clamp(treeStart.current.width + deltaX, MIN_TREE_WIDTH, treeStart.current.maxWidth))
    } else {
      setTreeHeight(clamp(treeStart.current.height + deltaY, MIN_TREE_HEIGHT, treeStart.current.maxHeight))
    }
  }

  const startDetailResize = (): void => {
    detailStart.current = {
      ratio: detailRatio,
      height: stackRef.current?.getBoundingClientRect().height ?? 0,
    }
  }

  const resizeDetail = (_deltaX: number, deltaY: number): void => {
    const height = detailStart.current.height
    if (height <= 0) return
    setDetailRatio(clamp(detailStart.current.ratio - deltaY / height, MIN_DETAIL_RATIO, MAX_DETAIL_RATIO))
  }

  const bodyStyle = {
    '--gitlog-tree-w': `${treeWidth}px`,
    '--gitlog-tree-h': `${treeHeight}px`,
  } as unknown as React.CSSProperties

  const detailStyle: React.CSSProperties = { flexBasis: `${detailRatio * 100}%` }

  const openCommitMenu = (commit: Commit, event: React.MouseEvent): void => {
    event.preventDefault()
    void view.selectCommit(commit)
    setCommitMenu({ commit, x: event.clientX, y: event.clientY })
  }

  const openSubmodule = (path: string): void => {
    const root = view.repo?.repoRoot ?? view.pathInput.trim()
    if (root === '') return
    const separator = root.includes('\\') ? '\\' : '/'
    view.openPath(`${root.replace(/[\\/]+$/, '')}${separator}${path}`)
  }

  const body = (
    <div ref={bodyRef} className="dsh-gitlog-body has-tree" style={bodyStyle}>
      <RefsTree
        tree={view.tree}
        status={view.treeStatus}
        error={view.treeError}
        selection={view.selection}
        switching={view.switching}
        onSelect={view.selectRef}
        onSwitch={view.switchBranch}
        onOpenSubmodule={openSubmodule}
        t={t}
      />
      <Splitter
        orientation={treeOrientation}
        label={t('resizeTree')}
        onStart={startTreeResize}
        onDrag={resizeTree}
      />
      <div ref={stackRef} className="dsh-gitlog-stack">
        {viewMode === 'workspace'
          ? <WorkspacePane view={view} ws={ws} t={t} />
          : hasCommits
            ? <CommitList view={view} t={t} onContextMenu={openCommitMenu} />
            : <div className="dsh-gitlog-state-pane">{state}</div>}
        {viewMode === 'history' && hasCommits
          ? (
              <Splitter
                orientation="horizontal"
                label={t('resizeDetail')}
                onStart={startDetailResize}
                onDrag={resizeDetail}
              />
            )
          : null}
        {viewMode === 'history' && hasCommits
          ? (
              <aside className="dsh-gitlog-detail" style={detailStyle} aria-label={t('details')}>
                <DetailPane
                  detail={detail}
                  status={detailStatus}
                  error={detailError}
                  t={t}
                />
              </aside>
            )
          : null}
      </div>
    </div>
  )

  return (
    <div className="dsh-gitlog">
      <style>{CSS}</style>
      <div className="dsh-gitlog-topbar">
        <PanelControls view={view} t={t} />
        <div className="dsh-gitlog-header-actions">
          <button
            type="button"
            className="dsh-gitlog-btn dsh-gitlog-icon-btn"
            title={t('refresh')}
            aria-label={t('refresh')}
            onClick={view.refresh}
            disabled={status === 'loading'}
          >
            <RefreshIcon />
          </button>
          <button
            type="button"
            className="dsh-gitlog-btn dsh-gitlog-icon-btn"
            title={t('settings')}
            aria-label={t('settings')}
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon />
          </button>
        </div>
      </div>
      <RepoActions
        view={view}
        ws={ws}
        mode={viewMode}
        onShowWorkspace={() => setViewMode('workspace')}
        onModeChange={setViewMode}
        t={t}
      />
      {view.scanNote !== null ? <p className="dsh-gitlog-note">{view.scanNote}</p> : null}
      {view.switching ? <p className="dsh-gitlog-note" role="status">{t('switching')}</p> : null}
      {view.switchError !== null ? <p className="dsh-gitlog-note" role="alert">{view.switchError}</p> : null}
      {error !== null && commits.length > 0
        ? <p className="dsh-gitlog-note" role="status">{`${t('errorTitle')} · ${error.message}`}</p>
        : null}
      {body}
      {settingsOpen
        ? (
            <SettingsDialog
              limit={view.limit}
              t={t}
              onChange={view.setLimit}
              onClose={() => setSettingsOpen(false)}
            />
          )
        : null}
      <CommitActions
        view={view}
        context={commitMenu}
        t={t}
        onClose={() => setCommitMenu(null)}
      />
    </div>
  )
}


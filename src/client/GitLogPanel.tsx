import type * as React from 'react'
import { CommitActions, type CommitContext } from './components/CommitActions.js'
import { CommitList } from './components/CommitList.js'
import { BranchMenu, type BranchMenuState } from './components/BranchMenu.js'
import { BranchDeleteDialog, BranchRenameDialog } from './components/BranchDialogs.js'
import { DeleteRemoteDialog } from './components/DeleteRemoteDialog.js'
import { DetailPane } from './components/DetailPane.js'
import { ErrorState } from './components/ErrorState.js'
import { PanelControls } from './components/PanelControls.js'
import { RefsTree } from './components/RefsTree.js'
import { RemoteMenu, type RemoteMenuState } from './components/RemoteMenu.js'
import { Button } from './components/Button.js'
import { RefreshIcon } from './components/GitLogIcon.js'
import { RepoActions } from './components/RepoActions.js'
import { SettingsDialog, SettingsIcon } from './components/SettingsDialog.js'
import { Splitter } from './components/Splitter.js'
import { WorkspacePane } from './components/WorkspacePane.js'
import { EmptyState, LoadingState } from './components/States.js'
import { useGitLogView } from './hooks/useGitLogView.js'
import { useWorkspace } from './hooks/useWorkspace.js'
import { requestBranchAction, toApiError } from './lib/api.js'
import { readUiState, writeUiState } from './lib/ui-state.js'
import { h, useEffect, useRef, useState } from './runtime.js'
import { CSS } from './styles.js'
import type { Branch, Commit, Selection, Translate } from './types.js'

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
  const [treeWidth, setTreeWidth] = useState(() => clamp(readUiState().treeWidth ?? 240, MIN_TREE_WIDTH, MAX_TREE_WIDTH))
  const [treeHeight, setTreeHeight] = useState(() => clamp(readUiState().treeHeight ?? 220, MIN_TREE_HEIGHT, MAX_TREE_HEIGHT))
  const [detailRatio, setDetailRatio] = useState(() => clamp(readUiState().detailRatio ?? 0.45, MIN_DETAIL_RATIO, MAX_DETAIL_RATIO))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [viewMode, setViewModeState] = useState<'history' | 'workspace'>(() => readUiState().viewMode ?? 'history')
  const [commitMenu, setCommitMenu] = useState<CommitContext | null>(null)
  const [remoteMenu, setRemoteMenu] = useState<RemoteMenuState | null>(null)
  const [remoteDelete, setRemoteDelete] = useState<string | null>(null)
  const [branchMenu, setBranchMenu] = useState<BranchMenuState | null>(null)
  const [branchDialog, setBranchDialog] = useState<{ action: 'rename' | 'delete'; branch: Branch } | null>(null)
  const [branchActionError, setBranchActionError] = useState<string | null>(null)
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

  const setViewMode = (mode: 'history' | 'workspace'): void => {
    setViewModeState(mode)
    writeUiState({ viewMode: mode })
  }

  useEffect(() => {
    writeUiState({ treeWidth })
  }, [treeWidth])

  useEffect(() => {
    writeUiState({ treeHeight })
  }, [treeHeight])

  useEffect(() => {
    writeUiState({ detailRatio })
  }, [detailRatio])

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

  const fetchRemote = (remote: string): void => {
    ws.sync('fetch', undefined, { fetchAll: false, prune: true, tags: true, forceTags: false, remote })
  }

  const pullRemote = (remote: string): void => {
    const branch = ws.status?.branch ?? ''
    if (branch === '') return
    ws.sync('pull', { remote, branch })
  }

  const pushRemote = (remote: string): void => {
    const branch = ws.status?.branch ?? ''
    if (branch === '') return
    ws.pushBranches({
      remote,
      refs: [{ local: branch, remote: branch, track: false }],
      tags: false,
      force: false,
    })
  }

  const openBranchMenu = (selection: Selection, event: React.MouseEvent): void => {
    if (selection.kind !== 'branch' || selection.remote) return
    const branch = view.tree?.branches.find(item => item.ref === selection.ref)
    if (branch !== undefined) setBranchMenu({ branch, x: event.clientX, y: event.clientY })
  }

  const branchUpstream = (branch: Branch): { remote: string; branch: string } | null => {
    const upstream = branch.upstream ?? ''
    const slash = upstream.indexOf('/')
    return slash > 0 ? { remote: upstream.slice(0, slash), branch: upstream.slice(slash + 1) } : null
  }

  const checkoutBranch = (branch: Branch): void => {
    void view.switchBranch({ kind: 'branch', ref: branch.ref, name: branch.name, remote: false })
  }

  const mergeBranch = (branch: Branch): void => {
    void runBranchAction('merge', branch)
  }

  const rebaseBranch = (branch: Branch): void => {
    void runBranchAction('rebase', branch)
  }

  const runBranchAction = async (action: 'merge' | 'rebase', branch: Branch): Promise<void> => {
    setBranchActionError(null)
    try {
      await requestBranchAction({
        action,
        path: view.repo?.repoRoot ?? view.pathInput.trim(),
        branch: branch.name,
      })
      ws.refresh()
      view.refresh()
    } catch (error) {
      setBranchActionError(toApiError(error).message)
    }
  }

  const fetchBranch = (branch: Branch): void => {
    const upstream = branchUpstream(branch)
    if (upstream === null) return
    ws.sync('fetch', undefined, { fetchAll: false, prune: true, tags: true, forceTags: false, remote: upstream.remote })
  }

  const pullBranch = (branch: Branch): void => {
    const upstream = branchUpstream(branch)
    if (upstream === null) return
    ws.sync('pull', upstream)
  }

  const pushBranch = (branch: Branch): void => {
    const upstream = branchUpstream(branch)
    if (upstream === null) return
    ws.pushBranches({
      remote: upstream.remote,
      refs: [{ local: branch.name, remote: upstream.branch, track: false }],
      tags: false,
      force: false,
    })
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
        onRemoteMenu={(remote, event) => setRemoteMenu({ remote, x: event.clientX, y: event.clientY })}
        onBranchMenu={openBranchMenu}
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
          <Button
            iconOnly
            title={t('refresh')}
            onClick={view.refresh}
            disabled={status === 'loading'}
            icon={<RefreshIcon />}
          />
          <Button
            iconOnly
            title={t('settings')}
            onClick={() => setSettingsOpen(true)}
            ariaHasPopup="dialog"
            ariaExpanded={settingsOpen}
            icon={<SettingsIcon />}
          />
        </div>
      </div>
      <RepoActions
        view={view}
        ws={ws}
        mode={viewMode}
        onModeChange={setViewMode}
        t={t}
      />
      {view.scanNote !== null ? <p className="dsh-gitlog-note">{view.scanNote}</p> : null}
      {branchActionError !== null ? <p className="dsh-gitlog-note" role="alert">{branchActionError}</p> : null}
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
      <RemoteMenu
        context={remoteMenu}
        t={t}
        onFetch={fetchRemote}
        onPull={pullRemote}
        onPush={pushRemote}
        onDelete={setRemoteDelete}
        onClose={() => setRemoteMenu(null)}
      />
      {remoteDelete === null
        ? null
        : (
            <DeleteRemoteDialog
              view={view}
              remote={remoteDelete}
              t={t}
              onClose={() => setRemoteDelete(null)}
            />
          )}
      <BranchMenu
        context={branchMenu}
        t={t}
        onCheckout={checkoutBranch}
        onMerge={mergeBranch}
        onRebase={rebaseBranch}
        onFetch={fetchBranch}
        onPull={pullBranch}
        onPush={pushBranch}
        onRename={branch => setBranchDialog({ action: 'rename', branch })}
        onDelete={branch => setBranchDialog({ action: 'delete', branch })}
        onClose={() => setBranchMenu(null)}
      />
      {branchDialog === null
        ? null
        : branchDialog.action === 'rename'
          ? (
              <BranchRenameDialog
                view={view}
                branch={branchDialog.branch}
                t={t}
                onClose={() => setBranchDialog(null)}
              />
            )
          : (
              <BranchDeleteDialog
                view={view}
                branch={branchDialog.branch}
                t={t}
                onClose={() => setBranchDialog(null)}
              />
            )}
    </div>
  )
}


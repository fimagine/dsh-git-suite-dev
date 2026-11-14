import type * as React from 'react'
import { CommitActions, type CommitContext } from './components/CommitActions.js'
import { CommitList } from './components/CommitList.js'
import { AddRemoteDialog } from './components/AddRemoteDialog.js'
import { AddBranchDialog } from './components/AddBranchDialog.js'
import { EditRemoteDialog } from './components/EditRemoteDialog.js'
import { BranchMenu, type BranchMenuState } from './components/BranchMenu.js'
import { BranchDeleteDialog, BranchRenameDialog } from './components/BranchDialogs.js'
import { DeleteRemoteDialog } from './components/DeleteRemoteDialog.js'
import { DetailPane } from './components/DetailPane.js'
import { ErrorState } from './components/ErrorState.js'
import { PanelControls } from './components/PanelControls.js'
import { RefsTree } from './components/RefsTree.js'
import { RemoteMenu, type RemoteMenuState } from './components/RemoteMenu.js'
import { RemoteBranchMenu, type RemoteBranchMenuState, type RemoteBranchSelection } from './components/RemoteBranchMenu.js'
import { DeleteRemoteBranchDialog } from './components/DeleteRemoteBranchDialog.js'
import { TagMenu, type TagMenuState, type TagSelection } from './components/TagMenu.js'
import { EditTagDialog } from './components/EditTagDialog.js'
import { AddTagDialog } from './components/AddTagDialog.js'
import { DeleteTagDialog } from './components/DeleteTagDialog.js'
import { ForcePushTagDialog } from './components/ForcePushTagDialog.js'
import { FetchTagDialog } from './components/FetchTagDialog.js'
import { StashMenu, type StashMenuState } from './components/StashMenu.js'
import { ConflictBanner } from './components/ConflictBanner.js'
import { toast } from './components/Toast.js'
import { Button } from './components/Button.js'
import { RefreshIcon } from './components/GitLogIcon.js'
import { RepoActions } from './components/RepoActions.js'
import { SettingsDialog, SettingsIcon } from './components/SettingsDialog.js'
import { Splitter } from './components/Splitter.js'
import { ToastHost } from './components/Toast.js'
import { WorkspacePane } from './components/WorkspacePane.js'
import { EmptyState, LoadingState } from './components/States.js'
import { useGitLogView } from './hooks/useGitLogView.js'
import { useWorkspace } from './hooks/useWorkspace.js'
import { requestBranchAction, requestCheckout, requestCommitOp, requestOperation, requestSync, requestTagStatus, toApiError } from './lib/api.js'
import { readUiState, writeUiState } from './lib/ui-state.js'
import { h, useEffect, useRef, useState } from './runtime.js'
import { CSS } from './styles.js'
import type { Branch, Commit, OperationPayload, Selection, TagStatusPayload, Translate } from './types.js'

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

/** Split `origin/feature/x` into the remote name and the branch name on that remote. */
function splitRemoteBranch(name: string): { remote: string; branch: string } {
  const slash = name.indexOf('/')
  return slash <= 0 ? { remote: '', branch: name } : { remote: name.slice(0, slash), branch: name.slice(slash + 1) }
}

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
  const [remoteEdit, setRemoteEdit] = useState<string | null>(null)
  const [remoteBranchMenu, setRemoteBranchMenu] = useState<RemoteBranchMenuState | null>(null)
  const [remoteBranchDelete, setRemoteBranchDelete] = useState<{ remote: string; branch: string } | null>(null)
  const [addRemoteOpen, setAddRemoteOpen] = useState(false)
  const [addBranchOpen, setAddBranchOpen] = useState(false)
  const [branchMenu, setBranchMenu] = useState<BranchMenuState | null>(null)
  const [branchDialog, setBranchDialog] = useState<{ action: 'rename' | 'delete'; branch: Branch } | null>(null)
  const [branchActionError, setBranchActionError] = useState<string | null>(null)
  const [tagMenu, setTagMenu] = useState<TagMenuState | null>(null)
  const [stashMenu, setStashMenu] = useState<StashMenuState | null>(null)
  const [operation, setOperation] = useState<OperationPayload | null>(null)
  const [conflictBusy, setConflictBusy] = useState(false)
  const [tagStatus, setTagStatus] = useState<TagStatusPayload | null>(null)
  const [addTagOpen, setAddTagOpen] = useState(false)
  const [tagEdit, setTagEdit] = useState<string | null>(null)
  const [tagDelete, setTagDelete] = useState<string | null>(null)
  const [tagForcePush, setTagForcePush] = useState<string | null>(null)
  const [tagFetch, setTagFetch] = useState<string | null>(null)
  const [tagActionError, setTagActionError] = useState<string | null>(null)
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

  /** Right-click on a commit's ref chip: open the same menu the refs tree uses. */
  const openRefMenu = (ref: string, event: React.MouseEvent): boolean => {
    const x = event.clientX
    const y = event.clientY
    if (ref.startsWith('tag: ')) {
      const name = ref.slice('tag: '.length)
      setTagMenu({ tag: { kind: 'tag', ref: `refs/tags/${name}`, name }, status: tagStatus?.statuses[name], x, y })
      return true
    }
    const branchName = ref.startsWith('HEAD -> ') ? ref.slice('HEAD -> '.length) : ref
    const local = (view.tree?.branches ?? []).find(branch => branch.kind === 'local' && branch.name === branchName)
    if (local !== undefined) {
      setBranchMenu({ branch: local, x, y })
      return true
    }
    for (const group of view.tree?.remotes ?? []) {
      const branch = group.branches.find(item => item.name === branchName)
      if (branch !== undefined) {
        setRemoteBranchMenu({
          branch: { kind: 'branch', ref: branch.ref, name: branch.name, remote: true },
          x,
          y,
        })
        return true
      }
    }
    return false
  }

  /** Right-clicking a tag checks it out by detaching HEAD at the tag's commit. */
  const checkoutTag = async (tag: TagSelection): Promise<void> => {
    setTagActionError(null)
    try {
      await requestCheckout({
        path: view.repo?.repoRoot ?? view.pathInput.trim(),
        ref: tag.ref,
      })
      ws.refresh()
      view.selectRef({ kind: 'head' })
      view.refresh()
    } catch (error) {
      setTagActionError(toApiError(error).message)
    }
  }

  const upstreamRemote = (() => {
    const upstream = ws.status?.upstream ?? ''
    const slash = upstream.indexOf('/')
    return slash > 0 ? upstream.slice(0, slash) : (view.tree?.remotes[0]?.name ?? '')
  })()

  /** Compare local tags with the upstream remote (or the first configured one). */
  const runTagCompare = async (): Promise<void> => {
    const path = view.repo?.repoRoot ?? view.pathInput.trim()
    const remote = upstreamRemote
    if (path === '' || remote === '') return
    try {
      setTagStatus(await requestTagStatus({ path, remote }))
    } catch {
      // Unreachable remote or missing credentials: keep the tree clean.
      setTagStatus(null)
    }
  }

  // Compare automatically once per repository/remote/tag set, and again whenever
  // tags change; the compare button only re-runs it on demand.
  const tagsKey = view.tree === null ? '' : view.tree.tags.map(tag => `${tag.name}:${tag.hash}`).join(',')
  const lastTagCompare = useRef('')
  useEffect(() => {
    const root = view.repo?.repoRoot ?? ''
    if (root === '' || upstreamRemote === '') return undefined
    const key = `${root}\u0000${upstreamRemote}\u0000${tagsKey}`
    if (lastTagCompare.current === key) return undefined
    lastTagCompare.current = key
    const timer = window.setTimeout(() => { void runTagCompare() }, 400)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runTagCompare closes over the same values
  }, [view.repo?.repoRoot, upstreamRemote, tagsKey])

  /** Which merge/rebase/pick is stopped by conflicts, and its unmerged files. */
  const refreshOperation = async (signal?: AbortSignal): Promise<void> => {
    const target = view.repo?.repoRoot ?? view.pathInput.trim()
    if (target === '') {
      setOperation(null)
      return
    }
    try {
      setOperation(await requestOperation({ path: target }, signal))
    } catch {
      setOperation(null)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void refreshOperation(controller.signal)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the repository matters here
  }, [view.repo?.repoRoot])

  // A pull can end in a conflicted merge; re-read the state once syncing settles.
  useEffect(() => {
    if (ws.syncState !== 'idle') return
    void refreshOperation()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshOperation reads the current repo
  }, [ws.syncState])

  const conflictAction = async (action: 'continue' | 'skip' | 'abort'): Promise<void> => {
    if (conflictBusy) return
    setConflictBusy(true)
    try {
      await requestCommitOp({ path: view.repo?.repoRoot ?? view.pathInput.trim(), action })
      toast(action === 'continue' ? t('conflictContinued') : action === 'skip' ? t('conflictSkipped') : t('conflictAborted'))
      view.refresh()
      ws.refresh()
    } catch (error) {
      const failure = toApiError(error)
      toast(failure.code === 'operation-conflict' ? t('conflictStillBlocked') : failure.message, 'error')
    } finally {
      setConflictBusy(false)
      void refreshOperation()
    }
  }

  const resolveConflict = async (file: string, side: 'ours' | 'theirs'): Promise<void> => {
    if (conflictBusy) return
    setConflictBusy(true)
    try {
      await requestCommitOp({ path: view.repo?.repoRoot ?? view.pathInput.trim(), action: 'resolve', file, side })
      toast(t('conflictResolvedFile').replace('{file}', file))
      ws.refresh()
    } catch (error) {
      toast(toApiError(error).message, 'error')
    } finally {
      setConflictBusy(false)
      void refreshOperation()
    }
  }

  /** Push one tag to the upstream remote; `force` overwrites a moved remote tag. */
  const pushTag = async (tag: TagSelection, force: boolean): Promise<void> => {
    const path = view.repo?.repoRoot ?? view.pathInput.trim()
    if (path === '' || upstreamRemote === '') {
      setTagActionError(t('remoteMissing'))
      return
    }
    setTagActionError(null)
    try {
      await requestSync({
        action: 'push',
        path,
        remote: upstreamRemote,
        tagRefs: [tag.name],
        force,
      })
      ws.refresh()
      view.refresh()
      void runTagCompare()
    } catch (error) {
      setTagActionError(toApiError(error).message)
    }
  }

  /** Right-click actions on a remote-tracking branch such as `origin/main`. */
  const checkoutRemoteBranch = async (branch: RemoteBranchSelection): Promise<void> => {
    setBranchActionError(null)
    try {
      await requestBranchAction({
        action: 'track',
        path: view.repo?.repoRoot ?? view.pathInput.trim(),
        branch: branch.name,
      })
      ws.refresh()
      view.selectRef({ kind: 'head' })
      view.refresh()
    } catch (error) {
      setBranchActionError(toApiError(error).message)
    }
  }

  const mergeRemoteBranch = async (branch: RemoteBranchSelection): Promise<void> => {
    setBranchActionError(null)
    try {
      await requestBranchAction({
        action: 'merge',
        path: view.repo?.repoRoot ?? view.pathInput.trim(),
        branch: branch.name,
      })
      ws.refresh()
      view.refresh()
    } catch (error) {
      setBranchActionError(toApiError(error).message)
    }
  }

  const rebaseRemoteBranch = async (branch: RemoteBranchSelection): Promise<void> => {
    setBranchActionError(null)
    try {
      await requestBranchAction({
        action: 'rebase',
        path: view.repo?.repoRoot ?? view.pathInput.trim(),
        branch: branch.name,
      })
      ws.refresh()
      view.refresh()
    } catch (error) {
      setBranchActionError(toApiError(error).message)
    }
  }

  const pullRemoteBranch = (branch: RemoteBranchSelection): void => {
    const target = splitRemoteBranch(branch.name)
    if (target.remote === '') {
      setBranchActionError(t('remoteMissing'))
      return
    }
    ws.sync('pull', { remote: target.remote, branch: target.branch })
  }

  const deleteRemoteBranch = (branch: RemoteBranchSelection): void => {
    const target = splitRemoteBranch(branch.name)
    if (target.remote === '') {
      setBranchActionError(t('remoteMissing'))
      return
    }
    setRemoteBranchDelete({ remote: target.remote, branch: target.branch })
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
        onAddBranch={view.repo === null ? undefined : () => setAddBranchOpen(true)}
        onAddRemote={view.repo === null ? undefined : () => setAddRemoteOpen(true)}
        onAddTag={view.repo === null ? undefined : () => setAddTagOpen(true)}
        tagStatus={tagStatus}
        onTagMenu={(tag, event) => setTagMenu({
          tag,
          status: tagStatus?.statuses[tag.name],
          x: event.clientX,
          y: event.clientY,
        })}
        onRemoteBranchMenu={(branch, event) => setRemoteBranchMenu({ branch, x: event.clientX, y: event.clientY })}
        onStashMenu={(stash, event) => {
          const ref = 'ref' in stash && typeof stash.ref === 'string' ? stash.ref : ''
          if (ref !== '') setStashMenu({ selection: stash, ref, x: event.clientX, y: event.clientY })
        }}
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
          ? (
              <WorkspacePane
                view={view}
                ws={ws}
                t={t}
                operation={operation}
                onOperationChanged={() => { void refreshOperation() }}
              />
            )
          : hasCommits
            ? <CommitList view={view} t={t} onContextMenu={openCommitMenu} onRefContextMenu={openRefMenu} />
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
      <ToastHost />
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
      {operation === null
        ? null
        : (
            <ConflictBanner
              operation={operation}
              busy={conflictBusy}
              t={t}
              onContinue={() => { void conflictAction('continue') }}
              onSkip={() => { void conflictAction('skip') }}
              onAbort={() => { void conflictAction('abort') }}
            />
          )}
      {view.scanNote !== null ? <p className="dsh-gitlog-note">{view.scanNote}</p> : null}
      {branchActionError !== null ? <p className="dsh-gitlog-note" role="alert">{branchActionError}</p> : null}
      {tagActionError !== null ? <p className="dsh-gitlog-note" role="alert">{tagActionError}</p> : null}
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
        onChanged={() => {
          ws.refresh()
          void refreshOperation()
        }}
      />
      <StashMenu
        view={view}
        context={stashMenu}
        t={t}
        onChanged={() => {
          ws.refresh()
          view.refresh()
        }}
        onClose={() => setStashMenu(null)}
      />
      <RemoteMenu
        context={remoteMenu}
        t={t}
        onFetch={fetchRemote}
        onPull={pullRemote}
        onPush={pushRemote}
        onEdit={setRemoteEdit}
        onDelete={setRemoteDelete}
        onClose={() => setRemoteMenu(null)}
      />
      <TagMenu
        context={tagMenu}
        t={t}
        onCheckout={tag => { void checkoutTag(tag) }}
        onEdit={tag => setTagEdit(tag.name)}
        onPush={(tag, force) => {
          // Overwriting a published tag needs the explicit confirmation dialog.
          if (force) setTagForcePush(tag.name)
          else void pushTag(tag, false)
        }}
        onFetchTag={tag => setTagFetch(tag.name)}
        onDelete={tag => setTagDelete(tag.name)}
        onClose={() => setTagMenu(null)}
      />
      {tagEdit === null
        ? null
        : <EditTagDialog view={view} tag={tagEdit} t={t} onClose={() => setTagEdit(null)} />}
      {tagDelete === null
        ? null
        : <DeleteTagDialog view={view} tag={tagDelete} t={t} onClose={() => setTagDelete(null)} />}
      {tagForcePush === null || upstreamRemote === ''
        ? null
        : (
            <ForcePushTagDialog
              view={view}
              tag={tagForcePush}
              remote={upstreamRemote}
              t={t}
              onPushed={() => {
                ws.refresh()
                void runTagCompare()
              }}
              onClose={() => setTagForcePush(null)}
            />
          )}
      {tagFetch === null || upstreamRemote === ''
        ? null
        : (
            <FetchTagDialog
              view={view}
              tag={tagFetch}
              remote={upstreamRemote}
              t={t}
              onFetched={() => {
                ws.refresh()
                view.refresh()
                void runTagCompare()
              }}
              onClose={() => setTagFetch(null)}
            />
          )}
      {addTagOpen
        ? <AddTagDialog view={view} t={t} onClose={() => setAddTagOpen(false)} />
        : null}
      <RemoteBranchMenu
        context={remoteBranchMenu}
        t={t}
        onCheckout={branch => { void checkoutRemoteBranch(branch) }}
        onMerge={branch => { void mergeRemoteBranch(branch) }}
        onRebase={branch => { void rebaseRemoteBranch(branch) }}
        onPull={pullRemoteBranch}
        onDelete={deleteRemoteBranch}
        onClose={() => setRemoteBranchMenu(null)}
      />
      {remoteBranchDelete === null
        ? null
        : (
            <DeleteRemoteBranchDialog
              view={view}
              remote={remoteBranchDelete.remote}
              branch={remoteBranchDelete.branch}
              t={t}
              onClose={() => setRemoteBranchDelete(null)}
            />
          )}
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
      {remoteEdit === null
        ? null
        : (
            <EditRemoteDialog
              view={view}
              remote={remoteEdit}
              url={view.tree?.remotes.find(group => group.name === remoteEdit)?.url ?? ''}
              t={t}
              onClose={() => setRemoteEdit(null)}
            />
          )}
      {addRemoteOpen
        ? <AddRemoteDialog view={view} t={t} onClose={() => setAddRemoteOpen(false)} />
        : null}
      {addBranchOpen
        ? <AddBranchDialog view={view} t={t} onClose={() => setAddBranchOpen(false)} />
        : null}
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


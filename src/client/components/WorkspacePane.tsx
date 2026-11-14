import type * as React from 'react'
import { h, useEffect, useRef, useState } from '../runtime.js'
import type { GitLogView } from '../hooks/useGitLogView.js'
import type { WorkspaceView } from '../hooks/useWorkspace.js'
import { requestCommitOp, requestRevealFile, toApiError } from '../lib/api.js'
import { useSplitSize } from '../lib/use-split-size.js'
import { readUiState, writeUiState } from '../lib/ui-state.js'
import { MinusIcon, PlusIcon, RefreshIcon, SparkleIcon } from './GitLogIcon.js'
import { Button } from './Button.js'
import { Splitter } from './Splitter.js'
import { toast } from './Toast.js'
import { hideTooltip, showTooltip, tooltipProps } from './Tooltip.js'
import { FileActionDialog } from './FileActionDialog.js'
import { IgnoreFileDialog } from './IgnoreFileDialog.js'
import { StashCreateDialog } from './StashCreateDialog.js'
import type { ConflictFile, OperationPayload, Translate, WorkspaceFile, WorkspaceScope } from '../types.js'

function scopeOf(file: WorkspaceFile): WorkspaceScope {
  if (file.staged) return 'staged'
  return file.untracked ? 'untracked' : 'unstaged'
}

/** Colour class for a status letter: M yellow, U green, D red, R/C blue, A green. */
function statusTone(status: string): string {
  switch (status) {
    case 'M':
    case 'T':
      return 'is-modified'
    case 'U':
    case '?':
      return 'is-untracked'
    case 'A':
      return 'is-added'
    case 'D':
      return 'is-deleted'
    case 'R':
    case 'C':
      return 'is-renamed'
    default:
      return ''
  }
}

/** Working-tree panel: staged/unstaged files, per-file diff, and the commit form. */
export function WorkspacePane({ view, ws, t, narrow = false, operation, onOperationChanged }: {
  view: GitLogView
  ws: WorkspaceView
  t: Translate
  /** Stacked layout: the files column sits above the diff instead of beside it. */
  narrow?: boolean
  /** Conflicts of an in-progress merge/rebase, when one is stopped. */
  operation?: OperationPayload | null
  onOperationChanged?(): void
}): React.ReactElement {
  const path = view.repo?.repoRoot ?? view.pathInput.trim()
  const [checked, setChecked] = useState<{ staged: string[]; unstaged: string[] }>({ staged: [], unstaged: [] })
  const [fileMenu, setFileMenu] = useState<{ file: WorkspaceFile; x: number; y: number } | null>(null)
  const [fileAction, setFileAction] = useState<{ kind: 'discard' | 'delete'; file: string } | null>(null)
  const [ignoreFile, setIgnoreFile] = useState<string | null>(null)
  const [stashOpen, setStashOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const status = ws.status
  const staged = status?.staged ?? []
  const unstaged = status?.unstaged ?? []

  const toggleCheck = (group: 'staged' | 'unstaged', file: string): void => {
    setChecked(current => {
      const list = current[group]
      const next = list.includes(file) ? list.filter(item => item !== file) : [...list, file]
      return { ...current, [group]: next }
    })
  }

  useEffect(() => {
    if (fileMenu === null) return undefined
    const onPointerDown = (event: MouseEvent): void => {
      if (menuRef.current !== null && !menuRef.current.contains(event.target as Node)) setFileMenu(null)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setFileMenu(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [fileMenu])

  /** Show one working-tree file in the OS file browser; a missing file becomes a toast. */
  const revealFile = async (file: WorkspaceFile): Promise<void> => {
    try {
      await requestRevealFile({ path, file: file.path })
    } catch (error) {
      const failure = toApiError(error)
      toast(
        failure.code === 'file-missing'
          ? t('fileMissing').replace('{file}', file.path)
          : failure.message,
        'error',
      )
    }
  }

  /** Double-click flips one file between staged and unstaged. */
  const toggleStage = (file: WorkspaceFile, scope: WorkspaceScope): void => {
    if (scope === 'staged') ws.unstage([file.path])
    else ws.stage([file.path])
  }

  /** Which sides still exist for a conflicted file (from the operation payload). */
  const conflictSideOf = (file: string): ConflictFile | undefined => operation?.conflicts.find(entry => entry.path === file)

  /** Resolve one conflicted file by keeping the ours or theirs side. */
  const resolveConflict = async (file: WorkspaceFile, side: 'ours' | 'theirs'): Promise<void> => {
    try {
      await requestCommitOp({ path, action: 'resolve', file: file.path, side })
      toast(t('conflictResolvedFile').replace('{file}', file.path))
      ws.refresh()
      view.refresh()
      onOperationChanged?.()
    } catch (error) {
      toast(toApiError(error).message, 'error')
    }
  }

  /** Absolute path of a working-tree file, using the repository's separator. */
  const absolutePath = (relative: string): string => {
    const root = path.replace(/[\\/]+$/, '')
    const separator = root.includes('\\') ? '\\' : '/'
    return `${root}${separator}${relative.replace(/^[\\/]+/, '')}`
  }

  /** Tooltip for the whole row: the absolute path and the status in words. */
  const rowHint = (file: WorkspaceFile): string => {
    const from = file.origPath === undefined ? '' : ` (from ${file.origPath})`
    return `${absolutePath(file.path)} - ${statusLabel(file)}${from}`
  }

  const statusLabel = (file: WorkspaceFile): string => {
    if (file.unmerged === true) return t('statusConflicted')
    switch (file.status) {
      case 'M':
        return t('statusModified')
      case 'T':
        return t('statusTypeChange')
      case 'U':
      case '?':
        return t('statusUntracked')
      case 'A':
        return t('statusAdded')
      case 'D':
        return t('statusDeleted')
      case 'R':
        return t('statusRenamed')
      case 'C':
        return t('statusCopied')
      default:
        return file.status
    }
  }

  const fileRow = (file: WorkspaceFile): React.ReactElement => {
    const scope = scopeOf(file)
    const conflicted = file.unmerged === true
    const conflictSides = conflicted && operation !== null && operation !== undefined
      ? operation.conflicts.find(conflict => conflict.path === file.path)
      : undefined
    const selected = ws.selected?.path === file.path && ws.selected.scope === scope
    const group = scope === 'staged' ? 'staged' : 'unstaged'
    const isChecked = checked[group].includes(file.path)
    return (
      <div
        key={`${scope}:${file.path}`}
        className={`dsh-gitlog-workspace-file${selected ? ' is-selected' : ''}`}
        {...tooltipProps(() => rowHint(file))}
        onClick={() => ws.selectFile(file.path, scope)}
        onDoubleClick={() => toggleStage(file, scope)}
        onContextMenu={event => {
          event.preventDefault()
          setFileMenu({ file, x: event.clientX, y: event.clientY })
        }}
      >
        <input
          type="checkbox"
          checked={isChecked}
          onClick={event => event.stopPropagation()}
          onDoubleClick={event => event.stopPropagation()}
          onChange={() => toggleCheck(group, file.path)}
          aria-label={file.path}
        />
        {conflicted
          ? <span className="dsh-gitlog-workspace-status is-conflict">{t('conflictBadge')}</span>
          : <span className={`dsh-gitlog-workspace-status ${statusTone(file.status)}`}>{file.status}</span>}
        <span className="dsh-gitlog-workspace-path">
          {file.path}
        </span>
        {file.binary
          ? <span className="dsh-gitlog-binary">{t('binary')}</span>
          : (
              <span className="dsh-gitlog-workspace-stats">
                {file.additions === null ? null : <span className="dsh-gitlog-add">{`+${file.additions}`}</span>}
                {file.deletions === null ? null : <span className="dsh-gitlog-del">{`-${file.deletions}`}</span>}
              </span>
            )}
        <button
          type="button"
          className="dsh-gitlog-workspace-file-action"
                    aria-label={conflicted ? t('markResolved') : scope === 'staged' ? t('unstageFile') : t('stageFile')}
          onClick={event => {
            event.stopPropagation()
            toggleStage(file, scope)
          }}
          onDoubleClick={event => event.stopPropagation()}
          onMouseEnter={event => showTooltip(
            conflicted ? t('markResolved') : scope === 'staged' ? t('unstageFile') : t('stageFile'),
            event.currentTarget.getBoundingClientRect(),
          )}
          onMouseLeave={hideTooltip}
        >
          {scope === 'staged' ? <MinusIcon size={14} /> : <PlusIcon size={14} />}
        </button>
      </div>
    )
  }

  const bodyRef = useRef<HTMLDivElement | null>(null)
  const filesRef = useRef<HTMLDivElement | null>(null)
  const stagedRef = useRef<HTMLElement | null>(null)
  const filesSize = useSplitSize({
    initial: () => readUiState().commitFilesWidth ?? 380,
    min: 260,
    max: () => {
      const width = bodyRef.current?.getBoundingClientRect().width ?? 0
      return width <= 0 ? 520 : Math.max(260, Math.min(width - 320, width * 0.7))
    },
    axis: 'x',
    persist: value => writeUiState({ commitFilesWidth: value }),
  })
  // The form is anchored at the bottom, so dragging up grows it.
  const commitSize = useSplitSize({
    initial: () => readUiState().commitFormHeight ?? 220,
    min: 150,
    max: () => {
      const height = filesRef.current?.getBoundingClientRect().height ?? 0
      return height <= 0 ? 420 : Math.max(160, height - 240)
    },
    axis: 'y',
    invert: true,
    persist: value => writeUiState({ commitFormHeight: value }),
  })
  const stagedSize = useSplitSize({
    initial: () => readUiState().commitStagedHeight ?? 180,
    min: 90,
    measure: () => stagedRef.current?.getBoundingClientRect().height ?? 0,
    max: () => {
      const height = filesRef.current?.getBoundingClientRect().height ?? 0
      return height <= 0 ? 420 : Math.max(120, height - commitSize.size - 150)
    },
    axis: 'y',
    persist: value => writeUiState({ commitStagedHeight: value }),
  })

  const section = (group: 'staged' | 'unstaged', files: WorkspaceFile[], style?: React.CSSProperties, nodeRef?: React.Ref<HTMLElement>): React.ReactElement => {
    const isStaged = group === 'staged'
    const hasChecked = checked[group].length > 0
    const selectedAction = (): void => {
      if (isStaged) {
        ws.unstage(checked.staged)
        setChecked(current => ({ ...current, staged: [] }))
      } else {
        ws.stage(checked.unstaged)
        setChecked(current => ({ ...current, unstaged: [] }))
      }
    }
    const allAction = (): void => {
      if (isStaged) {
        ws.unstageAll()
        setChecked(current => ({ ...current, staged: [] }))
      } else {
        ws.stageAll()
        setChecked(current => ({ ...current, unstaged: [] }))
      }
    }
    return (
      <section className="dsh-gitlog-workspace-section" style={style} ref={nodeRef}>
        <div className="dsh-gitlog-workspace-section-head">
          <h3>{`${isStaged ? t('stagedFiles') : t('unstagedFiles')} (${files.length})`}</h3>
          <span className="dsh-gitlog-workspace-section-actions">
            <Button
              disabled={!hasChecked || ws.actionState === 'loading'}
              onClick={selectedAction}
            >
              {isStaged ? t('unstageSelected') : t('stageSelected')}
            </Button>
            <Button
              disabled={files.length === 0 || ws.actionState === 'loading'}
              onClick={allAction}
            >
              {isStaged ? t('unstageAll') : t('stageAll')}
            </Button>
            {isStaged
              ? null
              : (
                  <Button
                    disabled={ws.status === null || ws.actionState === 'loading'}
                    title={t('stashHint')}
                    onClick={() => setStashOpen(true)}
                  >
                    {t('stashCreate')}
                  </Button>
                )}
          </span>
        </div>
        <div className="dsh-gitlog-workspace-list">
          {files.length === 0
            ? <p className="dsh-gitlog-workspace-empty">{isStaged ? t('noStaged') : t('noUnstaged')}</p>
            : files.map(file => fileRow(file))}
        </div>
      </section>
    )
  }

  const commitForm = (
    <div
      className="dsh-gitlog-workspace-commit"
      style={{ flex: '0 0 auto', height: `${commitSize.size}px` }}
    >
      <div className="dsh-gitlog-workspace-author">
        {status?.author.name
          ? `${status.author.name} <${status.author.email}>`
          : t('notConfigured')}
      </div>
      <div className="dsh-gitlog-workspace-message-head">
        <span>{t('commitMessage')}</span>
      </div>
      <textarea
        className="dsh-gitlog-workspace-message"
        value={ws.message}
        placeholder={t('commitMessage')}
        onChange={event => ws.setMessage(event.target.value)}
        rows={3}
        spellCheck={false}
      />
      {ws.generateError !== null ? <p className="dsh-gitlog-note" role="alert">{ws.generateError.message}</p> : null}
      <div className="dsh-gitlog-workspace-options">
        <label className="dsh-gitlog-check">
          <input
            type="checkbox"
            checked={ws.amend}
            onChange={event => ws.setAmend(event.target.checked)}
          />
          {t('amendLastCommit')}
        </label>
        <label className="dsh-gitlog-check">
          <input
            type="checkbox"
            checked={ws.push}
            disabled={status?.upstream === null || status === null}
            onChange={event => ws.setPush(event.target.checked)}
          />
          {status?.upstream === null || status === null
            ? t('noUpstream')
            : `${t('pushAfterCommit')} ${status.upstream}`}
        </label>
      </div>
      {ws.note !== null ? <p className="dsh-gitlog-note" role="status">{ws.note}</p> : null}
      {ws.actionError !== null ? <p className="dsh-gitlog-note" role="alert">{ws.actionError.message}</p> : null}
      <div className="dsh-gitlog-workspace-commit-actions">
        <Button
          iconOnly
          className="dsh-gitlog-generate-btn"
          title={ws.generateState === 'loading' ? t('generatingMessage') : t('generateMessage')}
          onClick={ws.generate}
          disabled={ws.generateState === 'loading'
            || ws.actionState === 'loading'
            || path === ''
            || (staged.length === 0 && unstaged.length === 0)}
          icon={<SparkleIcon />}
        />
        <Button
          variant="primary"
          disabled={ws.actionState === 'loading' || ws.message.trim() === '' || (staged.length === 0 && !ws.amend)}
          onClick={ws.commit}
        >
          {ws.actionState === 'loading' ? t('committing') : t('commit')}
        </Button>
      </div>
    </div>
  )

  const scopeLabel = ws.selected?.scope === 'staged'
    ? t('staged')
    : ws.selected?.scope === 'untracked'
      ? t('untracked')
      : t('unstaged')

  const diffPane = (
    <div className="dsh-gitlog-workspace-diff">
      <div className="dsh-gitlog-workspace-diff-head">
        <h3>{t('patch')}</h3>
        {ws.selected !== null
          ? <code className="dsh-gitlog-patch-file" {...tooltipProps(ws.selected.path)}>{`${scopeLabel} · ${ws.selected.path}`}</code>
          : null}
      </div>
      {ws.selected === null
        ? <p className="dsh-gitlog-workspace-empty">{t('selectFileToViewDiff')}</p>
        : ws.diffState === 'loading'
          ? <p className="dsh-gitlog-workspace-empty">{t('loadingDiff')}</p>
          : ws.diffState === 'error'
            ? <p className="dsh-gitlog-note" role="alert">{ws.diffError?.message ?? t('unknownError')}</p>
            : ws.diff !== null
              ? ws.diff.binary
                ? <p className="dsh-gitlog-workspace-empty">{t('binary')}</p>
                : (
                    <div className="dsh-gitlog-workspace-diff-body">
                      <pre className="dsh-gitlog-patch" spellCheck={false}>{ws.diff.patch === '' ? t('fileNoPatch') : ws.diff.patch}</pre>
                      {ws.diff.truncated ? <p className="dsh-gitlog-note">{t('patchTruncated')}</p> : null}
                    </div>
                  )
              : null}
    </div>
  )

  return (
    <div className="dsh-gitlog-workspace">
      <div className="dsh-gitlog-workspace-head">
        <div className="dsh-gitlog-workspace-title">
          {status !== null
            ? (
                <span className="dsh-gitlog-workspace-branch" {...(status.upstream === null ? {} : tooltipProps(status.upstream))}>
                  {status.branch}
                  {status.upstream === null
                    ? ''
                    : ` · ${status.upstream} ↑${status.ahead} ↓${status.behind}`}
                </span>
              )
            : null}
        </div>
        <span className="dsh-gitlog-workspace-spacer" />
        {ws.statusState === 'loading' ? <span className="dsh-gitlog-spinner" aria-hidden={true} /> : null}
        <Button
          iconOnly
          title={t('refresh')}
          onClick={ws.refresh}
          disabled={ws.statusState === 'loading' || path === ''}
          icon={<RefreshIcon />}
        />
      </div>
      {path === ''
        ? <p className="dsh-gitlog-workspace-empty">{t('workspaceNoRepo')}</p>
        : ws.statusState === 'error'
          ? (
              <div className="dsh-gitlog-workspace-empty">
                <p>{ws.statusError?.message ?? t('unknownError')}</p>
                <Button onClick={ws.refresh}>{t('tryAgain')}</Button>
              </div>
            )
          : (
              <div
                ref={bodyRef}
                className="dsh-gitlog-workspace-body"
                style={narrow ? undefined : { gridTemplateColumns: `${filesSize.size}px 6px minmax(0, 1fr)` }}
              >
                <div ref={filesRef} className="dsh-gitlog-workspace-files">
                  {section(
                    'staged',
                    staged,
                    staged.length > 0 && unstaged.length > 0 && stagedSize.touched
                      ? { flex: '0 0 auto', height: `${stagedSize.size}px` }
                      : undefined,
                    stagedRef,
                  )}
                  {staged.length > 0 && unstaged.length > 0
                    ? (
                        <Splitter
                          orientation="horizontal"
                          label={t('resizeStaged')}
                          onStart={stagedSize.start}
                          onDrag={stagedSize.drag}
                          onReset={stagedSize.reset}
                        />
                      )
                    : null}
                  {section('unstaged', unstaged)}
                  <Splitter
                    orientation="horizontal"
                    label={t('resizeCommitForm')}
                    onStart={commitSize.start}
                    onDrag={commitSize.drag}
                    onReset={commitSize.reset}
                  />
                  {commitForm}
                </div>
                {narrow
                  ? null
                  : (
                      <Splitter
                        orientation="vertical"
                        label={t('resizeCommitFiles')}
                        onStart={filesSize.start}
                        onDrag={filesSize.drag}
                       onReset={filesSize.reset}
                      />
                    )}
                {diffPane}
              </div>
            )}
      {fileMenu === null
        ? null
        : (
            <div
              ref={menuRef}
              className="dsh-gitlog-commit-menu dsh-gitlog-file-menu"
              style={{
                left: Math.min(fileMenu.x, window.innerWidth - 220),
                top: Math.min(fileMenu.y, window.innerHeight - 100),
              }}
              role="menu"
              aria-label={t('fileMenu')}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  void revealFile(fileMenu.file)
                  setFileMenu(null)
                }}
              >
                {t('revealInExplorer')}
              </button>
              {fileMenu.file.unmerged !== true ? null : (
                <button
                  type="button"
                  role="menuitem"
                  disabled={conflictSideOf(fileMenu.file.path)?.ours === false}
                  onClick={() => {
                    const file = fileMenu.file
                    setFileMenu(null)
                    void resolveConflict(file, 'ours')
                  }}
                >
                  {t('conflictTakeOurs')}
                </button>
              )}
              {fileMenu.file.unmerged !== true ? null : (
                <button
                  type="button"
                  role="menuitem"
                  disabled={conflictSideOf(fileMenu.file.path)?.theirs === false}
                  onClick={() => {
                    const file = fileMenu.file
                    setFileMenu(null)
                    void resolveConflict(file, 'theirs')
                  }}
                >
                  {t('conflictTakeTheirs')}
                </button>
              )}
              {fileMenu.file.staged || fileMenu.file.unmerged === true
                ? null
                : (
                    <button
                      type="button"
                      role="menuitem"
                      className="danger"
                      onClick={() => {
                        setFileAction({
                          kind: fileMenu.file.untracked ? 'delete' : 'discard',
                          file: fileMenu.file.path,
                        })
                        setFileMenu(null)
                      }}
                    >
                      {fileMenu.file.untracked ? t('deleteFileMenu') : t('discardMenu')}
                    </button>
                  )}
              {fileMenu.file.staged || !fileMenu.file.untracked
                ? null
                : (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIgnoreFile(fileMenu.file.path)
                        setFileMenu(null)
                      }}
                    >
                      {t('ignoreMenu')}
                    </button>
                  )}
            </div>
          )}
      {fileAction === null
        ? null
        : (
            <FileActionDialog
              view={view}
              file={fileAction.file}
              action={fileAction.kind}
              t={t}
              onDone={() => ws.refresh()}
              onClose={() => setFileAction(null)}
            />
          )}
      {ignoreFile === null
        ? null
        : (
            <IgnoreFileDialog
              view={view}
              file={ignoreFile}
              t={t}
              onDone={() => ws.refresh()}
              onClose={() => setIgnoreFile(null)}
            />
          )}
      {stashOpen
        ? <StashCreateDialog view={view} ws={ws} t={t} onClose={() => setStashOpen(false)} />
        : null}
    </div>
  )
}












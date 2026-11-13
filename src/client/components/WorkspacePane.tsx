import type * as React from 'react'
import { h, useState } from '../runtime.js'
import type { GitLogView } from '../hooks/useGitLogView.js'
import type { WorkspaceView } from '../hooks/useWorkspace.js'
import { RefreshIcon, SparkleIcon } from './GitLogIcon.js'
import type { Translate, WorkspaceFile, WorkspaceScope } from '../types.js'

function scopeOf(file: WorkspaceFile): WorkspaceScope {
  if (file.staged) return 'staged'
  return file.untracked ? 'untracked' : 'unstaged'
}

/** Working-tree panel: staged/unstaged files, per-file diff, and the commit form. */
export function WorkspacePane({ view, ws, t }: { view: GitLogView; ws: WorkspaceView; t: Translate }): React.ReactElement {
  const path = view.repo?.repoRoot ?? view.pathInput.trim()
  const [checked, setChecked] = useState<{ staged: string[]; unstaged: string[] }>({ staged: [], unstaged: [] })
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

  const fileRow = (file: WorkspaceFile): React.ReactElement => {
    const scope = scopeOf(file)
    const selected = ws.selected?.path === file.path && ws.selected.scope === scope
    const group = scope === 'staged' ? 'staged' : 'unstaged'
    const isChecked = checked[group].includes(file.path)
    return (
      <div
        key={`${scope}:${file.path}`}
        className={`dsh-gitlog-workspace-file${selected ? ' is-selected' : ''}`}
        onClick={() => ws.selectFile(file.path, scope)}
      >
        <input
          type="checkbox"
          checked={isChecked}
          onClick={event => event.stopPropagation()}
          onChange={() => toggleCheck(group, file.path)}
          aria-label={file.path}
        />
        <span className="dsh-gitlog-workspace-status">{file.status}</span>
        <span
          className="dsh-gitlog-workspace-path"
          title={file.origPath === undefined ? file.path : `${file.path} ← ${file.origPath}`}
        >
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
      </div>
    )
  }

  const section = (group: 'staged' | 'unstaged', files: WorkspaceFile[]): React.ReactElement => {
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
      <section className="dsh-gitlog-workspace-section">
        <div className="dsh-gitlog-workspace-section-head">
          <h3>{`${isStaged ? t('stagedFiles') : t('unstagedFiles')} (${files.length})`}</h3>
          <span className="dsh-gitlog-workspace-section-actions">
            <button
              type="button"
              className="dsh-gitlog-btn"
              disabled={!hasChecked || ws.actionState === 'loading'}
              onClick={selectedAction}
            >
              {isStaged ? t('unstageSelected') : t('stageSelected')}
            </button>
            <button
              type="button"
              className="dsh-gitlog-btn"
              disabled={files.length === 0 || ws.actionState === 'loading'}
              onClick={allAction}
            >
              {isStaged ? t('unstageAll') : t('stageAll')}
            </button>
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
    <div className="dsh-gitlog-workspace-commit">
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
        <button
          type="button"
          className="dsh-gitlog-btn dsh-gitlog-icon-btn dsh-gitlog-generate-btn"
          title={ws.generateState === 'loading' ? t('generatingMessage') : t('generateMessage')}
          aria-label={ws.generateState === 'loading' ? t('generatingMessage') : t('generateMessage')}
          onClick={ws.generate}
          disabled={ws.generateState === 'loading'
            || ws.actionState === 'loading'
            || path === ''
            || (staged.length === 0 && unstaged.length === 0)}
        >
          <SparkleIcon />
        </button>
        <button
          type="button"
          className="dsh-gitlog-btn primary"
          disabled={ws.actionState === 'loading' || ws.message.trim() === '' || (staged.length === 0 && !ws.amend)}
          onClick={ws.commit}
        >
          {ws.actionState === 'loading' ? t('committing') : t('commit')}
        </button>
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
          ? <code className="dsh-gitlog-patch-file" title={ws.selected.path}>{`${scopeLabel} · ${ws.selected.path}`}</code>
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
                <span className="dsh-gitlog-workspace-branch" title={status.upstream ?? undefined}>
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
        <button
          type="button"
          className="dsh-gitlog-btn dsh-gitlog-icon-btn"
          title={t('refresh')}
          aria-label={t('refresh')}
          onClick={ws.refresh}
          disabled={ws.statusState === 'loading' || path === ''}
        >
          <RefreshIcon />
        </button>
      </div>
      {path === ''
        ? <p className="dsh-gitlog-workspace-empty">{t('workspaceNoRepo')}</p>
        : ws.statusState === 'error'
          ? (
              <div className="dsh-gitlog-workspace-empty">
                <p>{ws.statusError?.message ?? t('unknownError')}</p>
                <button type="button" className="dsh-gitlog-btn" onClick={ws.refresh}>{t('tryAgain')}</button>
              </div>
            )
          : (
              <div className="dsh-gitlog-workspace-body">
                <div className="dsh-gitlog-workspace-files">
                  {section('staged', staged)}
                  {section('unstaged', unstaged)}
                  {commitForm}
                </div>
                {diffPane}
              </div>
            )}
    </div>
  )
}

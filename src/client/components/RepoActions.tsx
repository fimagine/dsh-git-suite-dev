import type * as React from 'react'
import { h, useState } from '../runtime.js'
import type { GitLogView } from '../hooks/useGitLogView.js'
import type { WorkspaceView } from '../hooks/useWorkspace.js'
import type { Translate } from '../types.js'
import { FetchIcon, PullIcon, PushIcon } from './GitLogIcon.js'
import { FetchDialog } from './FetchDialog.js'
import { PushDialog } from './PushDialog.js'
import { SyncDialog } from './SyncDialog.js'

export interface RepoActionsProps {
  view: GitLogView
  ws: WorkspaceView
  mode: 'history' | 'workspace'
  onModeChange(mode: 'history' | 'workspace'): void
  t: Translate
}

/** View switch plus pull / push / fetch, shown under the topbar. */
export function RepoActions({ view, ws, mode, onModeChange, t }: RepoActionsProps): React.ReactElement {
  const path = view.repo?.repoRoot ?? view.pathInput.trim()
  const remotes = view.tree?.remotes ?? []
  const syncBusy = ws.syncState === 'loading'
  const [pullOpen, setPullOpen] = useState(false)
  const [fetchOpen, setFetchOpen] = useState(false)
  const [pushOpen, setPushOpen] = useState(false)

  const syncLabel = (action: 'pull' | 'push' | 'fetch'): string => {
    if (syncBusy && ws.syncAction === action) {
      return action === 'pull' ? t('pulling') : action === 'push' ? t('pushing') : t('fetching')
    }
    return t(action)
  }

  return (
    <div className="dsh-gitlog-repo-actions">
      <div className="dsh-gitlog-view-switch" role="group" aria-label={t('viewMode')}>
        <button
          type="button"
          className="dsh-gitlog-btn"
          aria-pressed={mode === 'history'}
          onClick={() => onModeChange('history')}
        >
          {t('history')}
        </button>
        <button
          type="button"
          className="dsh-gitlog-btn"
          aria-pressed={mode === 'workspace'}
          onClick={() => onModeChange('workspace')}
        >
          {t('commit')}
        </button>
      </div>
      <button
        type="button"
        className="dsh-gitlog-workspace-action"
        title={t('pull')}
        onClick={() => setPullOpen(true)}
        disabled={syncBusy || path === '' || remotes.length === 0}
      >
        <PullIcon />
        <span>{syncLabel('pull')}</span>
      </button>
      <button
        type="button"
        className="dsh-gitlog-workspace-action"
        title={t('push')}
        onClick={() => setPushOpen(true)}
        disabled={syncBusy || path === '' || remotes.length === 0}
      >
        <PushIcon />
        <span>{syncLabel('push')}</span>
      </button>
      <button
        type="button"
        className="dsh-gitlog-workspace-action"
        title={t('fetch')}
        onClick={() => setFetchOpen(true)}
        disabled={syncBusy || path === ''}
      >
        <FetchIcon />
        <span>{syncLabel('fetch')}</span>
      </button>
      {ws.syncNote !== null ? <p className="dsh-gitlog-note" role="status">{ws.syncNote}</p> : null}
      {ws.syncError !== null ? <p className="dsh-gitlog-note" role="alert">{ws.syncError.message}</p> : null}
      {pullOpen
        ? (
            <SyncDialog
              action="pull"
              view={view}
              ws={ws}
              t={t}
              onClose={() => setPullOpen(false)}
            />
          )
        : null}
      {fetchOpen
        ? <FetchDialog ws={ws} t={t} onClose={() => setFetchOpen(false)} />
        : null}
      {pushOpen
        ? <PushDialog view={view} ws={ws} t={t} onClose={() => setPushOpen(false)} />
        : null}
    </div>
  )
}

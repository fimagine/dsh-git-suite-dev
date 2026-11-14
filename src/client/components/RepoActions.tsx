import type * as React from 'react'
import { h, useEffect, useState } from '../runtime.js'
import type { GitLogView } from '../hooks/useGitLogView.js'
import type { WorkspaceView } from '../hooks/useWorkspace.js'
import { requestApps, requestOpenApp, toApiError } from '../lib/api.js'
import type { Translate } from '../types.js'
import { Button } from './Button.js'
import { Switch } from './Switch.js'
import { VscodeIcon, FetchIcon, FolderIcon, PullIcon, PushIcon, TerminalIcon } from './GitLogIcon.js'
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

/** View switch plus pull / push / fetch and the "open with" actions, icon-only. */
export function RepoActions({ view, ws, mode, onModeChange, t }: RepoActionsProps): React.ReactElement {
  const path = view.repo?.repoRoot ?? view.pathInput.trim()
  const remotes = view.tree?.remotes ?? []
  const syncBusy = ws.syncState === 'loading'
  const [pullOpen, setPullOpen] = useState(false)
  const [fetchOpen, setFetchOpen] = useState(false)
  const [pushOpen, setPushOpen] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)
  const [vscode, setVscode] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    requestApps(controller.signal)
      .then(payload => {
        if (controller.signal.aborted) return
        setVscode(payload.vscode)
      })
      .catch(() => {
        // Detection is best effort: hide the editor button when it fails.
        if (!controller.signal.aborted) setVscode(false)
      })
    return () => controller.abort()
  }, [])

  const syncLabel = (action: 'pull' | 'push' | 'fetch'): string => {
    if (syncBusy && ws.syncAction === action) {
      return action === 'pull' ? t('pulling') : action === 'push' ? t('pushing') : t('fetching')
    }
    return t(action)
  }

  const openApp = async (target: 'terminal' | 'explorer' | 'vscode'): Promise<void> => {
    if (path === '') return
    setOpenError(null)
    try {
      await requestOpenApp({ path, target })
    } catch (error) {
      setOpenError(toApiError(error).message)
    }
  }

  // The OS file manager has a different name on every platform.
  const explorerLabel = ((): string => {
    const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent
    if (/Mac|iPhone|iPad/i.test(agent)) return t('finder')
    if (/Windows/i.test(agent)) return t('fileExplorer')
    return t('fileManager')
  })()

  return (
    <div className="dsh-gitlog-repo-actions">
      <Switch
        value={mode}
        ariaLabel={t('viewMode')}
        options={[
          { value: 'history' as const, label: t('history') },
          { value: 'workspace' as const, label: t('commit') },
        ]}
        onChange={onModeChange}
      />
      <Button
        variant="ghost"
        iconOnly
        title={syncLabel('pull')}
        icon={<PullIcon />}
        disabled={syncBusy || path === '' || remotes.length === 0}
        onClick={() => setPullOpen(true)}
      />
      <Button
        variant="ghost"
        iconOnly
        title={syncLabel('push')}
        icon={<PushIcon />}
        disabled={syncBusy || path === '' || remotes.length === 0}
        onClick={() => setPushOpen(true)}
      />
      <Button
        variant="ghost"
        iconOnly
        title={syncLabel('fetch')}
        icon={<FetchIcon />}
        disabled={syncBusy || path === ''}
        onClick={() => setFetchOpen(true)}
      />
      <Button
        variant="ghost"
        iconOnly
        title={t('openTerminal')}
        icon={<TerminalIcon />}
        disabled={path === ''}
        onClick={() => { void openApp('terminal') }}
      />
      <Button
        variant="ghost"
        iconOnly
        title={explorerLabel}
        icon={<FolderIcon />}
        disabled={path === ''}
        onClick={() => { void openApp('explorer') }}
      />
      {vscode
        ? (
            <Button
              variant="ghost"
              iconOnly
              title={t('openInVscode')}
              icon={<VscodeIcon />}
              disabled={path === ''}
              onClick={() => { void openApp('vscode') }}
            />
          )
        : null}
      {ws.syncNote !== null ? <p className="dsh-gitlog-note" role="status">{ws.syncNote}</p> : null}
      {ws.syncError !== null ? <p className="dsh-gitlog-note" role="alert">{ws.syncError.message}</p> : null}
      {openError === null ? null : <p className="dsh-gitlog-note" role="alert">{openError}</p>}
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




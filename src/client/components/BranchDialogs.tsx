import type * as React from 'react'
import { h, useState } from '../runtime.js'
import type { GitLogView } from '../hooks/useGitLogView.js'
import { requestBranchAction, toApiError } from '../lib/api.js'
import type { Branch, Translate } from '../types.js'
import { DialogShell } from './DialogShell.js'
import { Button, DialogActions } from './Button.js'

export interface BranchRenameDialogProps {
  view: GitLogView
  branch: Branch
  t: Translate
  onClose(): void
}

/** Rename one local branch. */
export function BranchRenameDialog({ view, branch, t, onClose }: BranchRenameDialogProps): React.ReactElement {
  const [name, setName] = useState(branch.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const value = name.trim()
    if (value === '') {
      setError(t('branchNameRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await requestBranchAction({
        action: 'rename',
        path: view.repo?.repoRoot ?? view.pathInput.trim(),
        branch: branch.name,
        newName: value,
      })
      view.selectRef({ kind: 'head' })
      onClose()
    } catch (failure) {
      setError(toApiError(failure).message)
      setBusy(false)
    }
  }

  return (
    <DialogShell title={t('branchRenameTitle')} t={t} onClose={onClose}>
      <form className="dsh-gitlog-repo-form" onSubmit={event => { void submit(event) }}>
        <label className="dsh-gitlog-field">
          <span>{t('branchName')}</span>
          <input
            type="text"
            value={name}
            onChange={event => setName(event.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoFocus
          />
        </label>
        {error === null ? null : <p className="dsh-gitlog-note" role="alert">{error}</p>}
        <DialogActions>
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? t('branchSaving') : t('branchRenameAction')}
          </Button>
        </DialogActions>
      </form>
    </DialogShell>
  )
}

export interface BranchDeleteDialogProps {
  view: GitLogView
  branch: Branch
  t: Translate
  onClose(): void
}

/** Confirm and delete one local branch. */
export function BranchDeleteDialog({ view, branch, t, onClose }: BranchDeleteDialogProps): React.ReactElement {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await requestBranchAction({
        action: 'delete',
        path: view.repo?.repoRoot ?? view.pathInput.trim(),
        branch: branch.name,
      })
      view.selectRef({ kind: 'head' })
      onClose()
    } catch (failure) {
      setError(toApiError(failure).message)
      setBusy(false)
    }
  }

  return (
    <DialogShell title={t('branchDeleteTitle')} t={t} onClose={onClose}>
      <p className="dsh-gitlog-note">{t('branchDeleteConfirm').replace('{branch}', branch.name)}</p>
      {error === null ? null : <p className="dsh-gitlog-note" role="alert">{error}</p>}
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button variant="danger" disabled={busy} onClick={() => { void confirm() }}>
          {busy ? t('branchDeleting') : t('branchDeleteAction')}
        </Button>
      </DialogActions>
    </DialogShell>
  )
}

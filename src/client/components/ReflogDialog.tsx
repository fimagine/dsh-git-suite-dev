import type * as React from 'react'
import { h, useEffect, useState } from '../runtime.js'
import type { GitLogView } from '../hooks/useGitLogView.js'
import { isAbortError, requestBranch, requestCommitOp, requestReflog, toApiError } from '../lib/api.js'
import { formatDateTime } from '../lib/format.js'
import type { ReflogEntry, Translate } from '../types.js'
import { Button, DialogActions } from './Button.js'
import { DialogShell } from './DialogShell.js'

export interface ReflogDialogProps {
  view: GitLogView
  t: Translate
  onDone(): void
  onClose(): void
}

/** Recent HEAD movements: recover a lost commit by branching or resetting to it. */
export function ReflogDialog({ view, t, onDone, onClose }: ReflogDialogProps): React.ReactElement {
  const path = view.repo?.repoRoot ?? view.pathInput.trim()
  const [entries, setEntries] = useState<ReflogEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ReflogEntry | null>(null)
  const [branchName, setBranchName] = useState('')
  const [resetConfirmed, setResetConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    requestReflog({ path, limit: 80 }, controller.signal)
      .then(payload => {
        if (controller.signal.aborted) return
        setEntries(payload.entries)
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted || isAbortError(failure)) return
        setEntries([])
        setError(toApiError(failure).message)
      })
    return () => controller.abort()
  }, [path])

  const select = (entry: ReflogEntry): void => {
    setSelected(entry)
    setBranchName(`reflog-${entry.shortHash}`)
    setResetConfirmed(false)
  }

  const createBranch = async (): Promise<void> => {
    if (busy || selected === null) return
    if (branchName.trim() === '') return
    setBusy(true)
    setError(null)
    try {
      await requestBranch({ path, name: branchName.trim(), base: selected.hash })
      onDone()
      onClose()
    } catch (failure) {
      setError(toApiError(failure).message)
      setBusy(false)
    }
  }

  const resetTo = async (): Promise<void> => {
    if (busy || selected === null || !resetConfirmed) return
    setBusy(true)
    setError(null)
    try {
      await requestCommitOp({ path, action: 'reset', hash: selected.hash, mode: 'hard' })
      onDone()
      onClose()
    } catch (failure) {
      setError(toApiError(failure).message)
      setBusy(false)
    }
  }

  return (
    <DialogShell title={t('reflogTitle')} t={t} wide={true} onClose={onClose}>
      <p className="dsh-gitlog-settings-hint">{t('reflogHint')}</p>
      {entries === null
        ? <p className="dsh-gitlog-note">{t('reflogLoading')}</p>
        : entries.length === 0
          ? <p className="dsh-gitlog-note">{t('reflogEmpty')}</p>
          : (
              <ul className="dsh-gitlog-reflog-list">
                {entries.map(entry => (
                  <li key={`${entry.selector}:${entry.hash}`}>
                    <button
                      type="button"
                      className={`dsh-gitlog-reflog-row${selected?.selector === entry.selector && selected.hash === entry.hash ? ' is-selected' : ''}`}
                      onClick={() => select(entry)}
                    >
                      <code className="dsh-gitlog-reflog-hash">{entry.shortHash}</code>
                      <span className="dsh-gitlog-reflog-action">{entry.action}</span>
                      <span className="dsh-gitlog-reflog-meta">
                        {`${entry.author} · ${formatDateTime(entry.date, t('localeId'))}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
      {selected === null
        ? null
        : (
            <div className="dsh-gitlog-reflog-actions">
              <label className="dsh-gitlog-field">
                <span>{t('reflogBranchLabel')}</span>
                <input
                  type="text"
                  value={branchName}
                  onChange={event => setBranchName(event.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
              <div className="dsh-gitlog-reflog-buttons">
                <Button variant="primary" disabled={busy || branchName.trim() === ''} onClick={() => { void createBranch() }}>
                  {t('reflogCreateBranch')}
                </Button>
                <label className="dsh-gitlog-check">
                  <input
                    type="checkbox"
                    checked={resetConfirmed}
                    onChange={event => setResetConfirmed(event.target.checked)}
                  />
                  {t('reflogResetConfirm')}
                </label>
                <Button variant="danger" disabled={busy || !resetConfirmed} onClick={() => { void resetTo() }}>
                  {t('reflogReset')}
                </Button>
              </div>
            </div>
          )}
      {error === null ? null : <p className="dsh-gitlog-note" role="alert">{error}</p>}
      <DialogActions>
        <Button onClick={onClose}>{t('close')}</Button>
      </DialogActions>
    </DialogShell>
  )
}

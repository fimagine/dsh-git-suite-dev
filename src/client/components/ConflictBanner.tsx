import type * as React from 'react'
import { h } from '../runtime.js'
import type { ConflictFile, OperationPayload, Translate } from '../types.js'
import { Button } from './Button.js'

export interface ConflictBannerProps {
  operation: OperationPayload
  busy: boolean
  t: Translate
  onContinue(): void
  onSkip(): void
  onAbort(): void
  onResolve(file: ConflictFile, side: 'ours' | 'theirs'): void
}

/** Banner while a merge/rebase/cherry-pick/revert is stopped by conflicts. */
export function ConflictBanner({
  operation,
  busy,
  t,
  onContinue,
  onSkip,
  onAbort,
  onResolve,
}: ConflictBannerProps): React.ReactElement | null {
  if (operation.operation === null) return null
  const name = operation.operation
  const remaining = operation.conflicts.length
  return (
    <div className="dsh-gitlog-conflict" role="alert">
      <div className="dsh-gitlog-conflict-head">
        <strong>{t('conflictOperation').replace('{operation}', name)}</strong>
        <span className="dsh-gitlog-conflict-count">
          {remaining === 0
            ? t('conflictAllResolved')
            : t('conflictFilesCount').replace('{count}', String(remaining))}
        </span>
        <span className="dsh-gitlog-conflict-actions">
          <Button disabled={busy} onClick={onContinue}>{t('conflictContinue')}</Button>
          {name === 'merge' ? null : <Button disabled={busy} onClick={onSkip}>{t('conflictSkip')}</Button>}
          <Button variant="danger" disabled={busy} onClick={onAbort}>{t('conflictAbortAction')}</Button>
        </span>
      </div>
      {remaining === 0
        ? null
        : (
            <ul className="dsh-gitlog-conflict-list">
              {operation.conflicts.map(file => (
                <li key={file.path} className="dsh-gitlog-conflict-file">
                  <span className="dsh-gitlog-conflict-path">{file.path}</span>
                  <Button
                    disabled={busy || !file.ours}
                    onClick={() => onResolve(file, 'ours')}
                  >
                    {t('conflictTakeOurs')}
                  </Button>
                  <Button
                    disabled={busy || !file.theirs}
                    onClick={() => onResolve(file, 'theirs')}
                  >
                    {t('conflictTakeTheirs')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
    </div>
  )
}

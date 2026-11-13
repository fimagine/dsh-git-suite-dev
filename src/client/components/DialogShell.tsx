import type * as React from 'react'
import { h, useEffect } from '../runtime.js'
import type { Translate } from '../types.js'

export interface DialogShellProps {
  title: string
  t: Translate
  onClose(): void
  children: React.ReactNode
}

/** Shared modal frame used by the repository and commit-action dialogs. */
export function DialogShell({ title, t, onClose, children }: DialogShellProps): React.ReactElement {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="dsh-gitlog-settings-backdrop"
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="dsh-gitlog-settings dsh-gitlog-repo-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="dsh-gitlog-settings-head">
          <h2>{title}</h2>
          <button
            type="button"
            className="dsh-gitlog-settings-close"
            onClick={onClose}
            aria-label={t('close')}
          >
            ×
          </button>
        </div>
        <div className="dsh-gitlog-settings-body">{children}</div>
      </div>
    </div>
  )
}

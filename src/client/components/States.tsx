import type * as React from 'react'
import { h } from '../runtime.js'
import type { Translate } from '../types.js'

export function LoadingState({ label }: { label: string }): React.ReactElement {
  return (
    <div className="dsh-gitlog-state">
      <span className="dsh-gitlog-spinner" aria-hidden={true} />
      <p>{label}</p>
    </div>
  )
}

export function LoadingLine({ label }: { label: string }): React.ReactElement {
  return (
    <div className="dsh-gitlog-loading-line">
      <span className="dsh-gitlog-spinner" aria-hidden={true} />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({ t, onRefresh }: { t: Translate; onRefresh(): void }): React.ReactElement {
  return (
    <div className="dsh-gitlog-state">
      <h2>{t('noCommits')}</h2>
      <p>{t('noCommitsHint')}</p>
      <button type="button" className="dsh-gitlog-btn" onClick={onRefresh}>{t('refresh')}</button>
    </div>
  )
}

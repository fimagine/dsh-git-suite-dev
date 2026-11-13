import type * as React from 'react'
import { h } from './runtime.js'
import { CommitList } from './components/CommitList.js'
import { DetailPane } from './components/DetailPane.js'
import { ErrorState } from './components/ErrorState.js'
import { PanelControls } from './components/PanelControls.js'
import { EmptyState, LoadingState } from './components/States.js'
import { useGitLogView } from './hooks/useGitLogView.js'
import { CSS } from './styles.js'
import type { Translate } from './types.js'

/** The main panel registered into the host's `main` slot. */
export function GitLogPanel({ t }: { t: Translate }): React.ReactElement {
  const view = useGitLogView(t)
  const { status, commits, error, detail, detailStatus, detailError, copied } = view

  let body: React.ReactElement
  if (status === 'loading' && commits.length === 0) {
    body = <LoadingState label={t('loadingCommits')} />
  } else if (status === 'error' && commits.length === 0) {
    body = <ErrorState error={error} t={t} onRetry={view.refresh} />
  } else if (commits.length === 0) {
    body = <EmptyState t={t} onRefresh={view.refresh} />
  } else {
    body = (
      <div className="dsh-gitlog-body">
        <CommitList view={view} t={t} />
        <aside className="dsh-gitlog-detail" aria-label={t('details')}>
          <DetailPane
            detail={detail}
            status={detailStatus}
            error={detailError}
            t={t}
            onClose={view.closeDetail}
            copied={copied}
            onCopy={view.copyHash}
          />
        </aside>
      </div>
    )
  }

  return (
    <div className="dsh-gitlog">
      <style>{CSS}</style>
      <header className="dsh-gitlog-header">
        <div className="dsh-gitlog-heading">
          <h1>{t('title')}</h1>
          <p className="dsh-gitlog-subtitle" title={view.repo ? view.repo.repoRoot : t('subtitle')}>
            {view.repo ? `${view.repo.repoName} · ${view.branchLabel} · ${view.repo.repoRoot}` : t('subtitle')}
          </p>
        </div>
        <button
          type="button"
          className="dsh-gitlog-btn"
          onClick={view.refresh}
          disabled={status === 'loading'}
        >
          {t('refresh')}
        </button>
      </header>
      <PanelControls view={view} t={t} />
      {view.scanNote !== null ? <p className="dsh-gitlog-note">{view.scanNote}</p> : null}
      {view.branchesNote !== null ? <p className="dsh-gitlog-note">{view.branchesNote}</p> : null}
      {error !== null && commits.length > 0
        ? <p className="dsh-gitlog-note" role="status">{`${t('errorTitle')} · ${error.message}`}</p>
        : null}
      {body}
    </div>
  )
}

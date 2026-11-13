import type * as React from 'react'
import { h } from '../runtime.js'
import type { GitLogView } from '../hooks/useGitLogView.js'
import type { Translate } from '../types.js'
import { CommitRow } from './CommitRow.js'
import { LoadingLine } from './States.js'

/** The paged commit list with the sticky count/ref header and the next-page control. */
export function CommitList({ view, t }: { view: GitLogView; t: Translate }): React.ReactElement {
  const { commits, selected, graph, geometry, status, hasMore } = view
  return (
    <section className="dsh-gitlog-list" aria-label={t('commits')}>
      <div className="dsh-gitlog-list-head">
        <span>{`${commits.length} ${t('commits')}`}</span>
        {view.repo ? <span className="dsh-gitlog-branch" title={view.branchLabel}>{view.branchLabel}</span> : null}
      </div>
      {commits.map((commit, index) => {
        const row = graph.rows[index]
        if (row === undefined) return null
        return (
          <CommitRow
            key={commit.hash}
            commit={commit}
            selected={selected === commit.hash}
            onSelect={view.selectCommit}
            t={t}
            row={row}
            geometry={geometry}
          />
        )
      })}
      {status === 'loading' ? <LoadingLine label={t('loadingCommits')} /> : null}
      {hasMore ? (
        <div className="dsh-gitlog-more">
          <button type="button" className="dsh-gitlog-btn" onClick={view.loadMore} disabled={status === 'loading'}>
            {t('loadMore')}
          </button>
        </div>
      ) : null}
    </section>
  )
}

import type * as React from 'react'
import { h } from '../runtime.js'
import { formatDateTime } from '../lib/format.js'
import type { GraphGeometry, GraphRow } from '../lib/graph.js'
import type { Commit, CommitColumns, Translate } from '../types.js'
import { CommitGraph } from './CommitGraph.js'
import { Refs } from './Refs.js'

/** One log line: the graph lane height has to match the row height (`.dsh-gitlog-commit`) so lines connect. */
export const COMMIT_ROW_HEIGHT = 26

export interface CommitRowProps {
  commit: Commit
  selected: boolean
  onSelect(commit: Commit): void
  onContextMenu?(commit: Commit, event: React.MouseEvent): void
  t: Translate
  row: GraphRow
  geometry: GraphGeometry
  /** Columns the header menu currently shows. */
  columns: CommitColumns
}

export function CommitRow({ commit, selected, onSelect, onContextMenu, t, row, geometry, columns }: CommitRowProps): React.ReactElement {
  const isMerge = commit.parents.length > 1
  return (
    <button
      type="button"
      className={`dsh-gitlog-commit${selected ? ' is-selected' : ''}`}
      aria-pressed={selected}
      onClick={() => onSelect(commit)}
      onContextMenu={event => onContextMenu?.(commit, event)}
      title={commit.subject}
    >
      {columns.graph
        ? (
            <span className="dsh-gitlog-graph" aria-hidden={true}>
              <CommitGraph row={row} geometry={geometry} height={COMMIT_ROW_HEIGHT} />
            </span>
          )
        : null}
      <span className="dsh-gitlog-desc">
        <Refs refs={commit.refs} />
        <span className="dsh-gitlog-subject">{commit.subject || t('noSubject')}</span>
        {isMerge ? <span className="dsh-gitlog-merge">{t('merge')}</span> : null}
      </span>
      {columns.date ? <span className="dsh-gitlog-commit-date">{formatDateTime(commit.date, t('localeId'))}</span> : null}
      {columns.author
        ? <span className="dsh-gitlog-commit-author" title={`${commit.author} <${commit.email}>`}>{commit.author}</span>
        : null}
      {columns.hash ? <code className="dsh-gitlog-commit-hash" title={commit.hash}>{commit.shortHash}</code> : null}
    </button>
  )
}

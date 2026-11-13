import type * as React from 'react'
import { h } from '../runtime.js'
import { formatDate, relativeTime } from '../lib/format.js'
import type { GraphGeometry, GraphRow } from '../lib/graph.js'
import type { Commit, Translate } from '../types.js'
import { CommitGraph } from './CommitGraph.js'
import { Refs } from './Refs.js'

export interface CommitRowProps {
  commit: Commit
  selected: boolean
  onSelect(commit: Commit): void
  t: Translate
  row: GraphRow
  geometry: GraphGeometry
}

export function CommitRow({ commit, selected, onSelect, t, row, geometry }: CommitRowProps): React.ReactElement {
  const isMerge = commit.parents.length > 1
  return (
    <button
      type="button"
      className={`dsh-gitlog-commit${selected ? ' is-selected' : ''}`}
      aria-pressed={selected}
      onClick={() => onSelect(commit)}
      title={commit.subject}
    >
      <span
        className="dsh-gitlog-graph"
        style={{ width: geometry.width, minWidth: geometry.width }}
        aria-hidden={true}
      >
        <CommitGraph row={row} geometry={geometry} />
      </span>
      <span className="dsh-gitlog-commit-main">
        <span className="dsh-gitlog-subject">{commit.subject || t('noSubject')}</span>
        <span className="dsh-gitlog-meta">
          <code className="dsh-gitlog-hash">{commit.shortHash}</code>
          {isMerge ? <span className="dsh-gitlog-merge">{t('merge')}</span> : null}
          <span aria-hidden={true}>·</span>
          <span>{commit.author}</span>
          <span aria-hidden={true}>·</span>
          <span title={formatDate(commit.date)}>{relativeTime(commit.date, t)}</span>
          <Refs refs={commit.refs} />
        </span>
      </span>
    </button>
  )
}

import type * as React from 'react'
import { h } from '../runtime.js'
import type { ApiError } from '../lib/api.js'
import { formatDate } from '../lib/format.js'
import type { CommitDetail, DetailStatus, Translate } from '../types.js'
import { Refs } from './Refs.js'

export interface DetailPaneProps {
  detail: CommitDetail | null
  status: DetailStatus
  error: ApiError | null
  t: Translate
  onClose(): void
  copied: boolean
  onCopy(): void
}

/** Right-hand pane: the selected commit's metadata, changed files, and patch. */
export function DetailPane({ detail, status, error, t, onClose, copied, onCopy }: DetailPaneProps): React.ReactElement {
  if (status === 'idle') {
    return (
      <div className="dsh-gitlog-state">
        <h2>{t('selectCommit')}</h2>
        <p>{t('selectCommitHint')}</p>
      </div>
    )
  }
  if (status === 'loading') {
    return (
      <div className="dsh-gitlog-state">
        <span className="dsh-gitlog-spinner" aria-hidden={true} />
        <p>{t('loadingCommit')}</p>
      </div>
    )
  }
  if (status === 'error' || detail === null) {
    return (
      <div className="dsh-gitlog-state">
        <h2>{t('errorTitle')}</h2>
        <p>{error?.message || t('unknownError')}</p>
        <button type="button" className="dsh-gitlog-btn" onClick={onClose}>{t('close')}</button>
      </div>
    )
  }

  return (
    <div className="dsh-gitlog-detail-inner">
      <div className="dsh-gitlog-detail-head">
        <div className="dsh-gitlog-detail-title">
          <code className="dsh-gitlog-hash">{detail.shortHash}</code>
          {detail.parents.length > 1
            ? <span className="dsh-gitlog-merge" style={{ marginLeft: '7px' }}>{t('merge')}</span>
            : null}
          <h2>{detail.subject || t('noSubject')}</h2>
          <div className="dsh-gitlog-detail-sub">{`${detail.author} · ${formatDate(detail.date)}`}</div>
        </div>
        <div className="dsh-gitlog-detail-actions">
          <button type="button" className="dsh-gitlog-small" onClick={onCopy}>
            {copied ? t('copied') : t('copyHash')}
          </button>
          <button type="button" className="dsh-gitlog-small" onClick={onClose}>{t('close')}</button>
        </div>
      </div>
      <Refs refs={detail.refs} />
      <dl className="dsh-gitlog-meta-grid">
        <dt>{t('author')}</dt>
        <dd>{`${detail.author} <${detail.email}>`}</dd>
        <dt>{t('date')}</dt>
        <dd>{formatDate(detail.date)}</dd>
        <dt>{t('parents')}</dt>
        <dd>{detail.parents.length === 0 ? t('rootCommit') : detail.parents.map(parent => parent.slice(0, 12)).join(', ')}</dd>
      </dl>
      {detail.body
        ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3>{t('commitBody')}</h3>
              <pre className="dsh-gitlog-body-text">{detail.body}</pre>
            </div>
          )
        : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h3>{`${t('changedFiles')} (${detail.files.length})`}</h3>
        {detail.files.length === 0
          ? <p className="dsh-gitlog-note">{t('noPatch')}</p>
          : (
              <ul className="dsh-gitlog-files">
                {detail.files.map(file => (
                  <li key={file.path} className="dsh-gitlog-file">
                    <span className="dsh-gitlog-file-path">{file.path}</span>
                    {file.binary
                      ? <span className="dsh-gitlog-binary">{t('binary')}</span>
                      : <span className="dsh-gitlog-add">{`+${file.additions ?? 0}`}</span>}
                    {file.binary ? <span /> : <span className="dsh-gitlog-del">{`-${file.deletions ?? 0}`}</span>}
                  </li>
                ))}
              </ul>
            )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h3>{t('patch')}</h3>
        {detail.patch
          ? <pre className="dsh-gitlog-patch" spellCheck={false}>{detail.patch}</pre>
          : <p className="dsh-gitlog-note">{t('noPatch')}</p>}
        {detail.patchTruncated ? <p className="dsh-gitlog-note">{t('patchTruncated')}</p> : null}
      </div>
    </div>
  )
}

import type * as React from 'react'
import { h, useMemo, useRef, useState } from '../runtime.js'
import type { ApiError } from '../lib/api.js'
import { formatDate } from '../lib/format.js'
import { splitPatch } from '../lib/patch.js'
import type { CommitDetail, DetailStatus, Translate } from '../types.js'
import { Refs } from './Refs.js'
import { Splitter } from './Splitter.js'

export interface DetailPaneProps {
  detail: CommitDetail | null
  status: DetailStatus
  error: ApiError | null
  t: Translate
}

const DEFAULT_INFO_RATIO = 0.4
const MIN_INFO_PX = 240

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * The pane under the log: commit metadata and changed files on the left, the
 * patch on the right. The sidebar layout stacks the two columns instead.
 */
export function DetailPane({ detail, status, error, t }: DetailPaneProps): React.ReactElement {
  const [infoRatio, setInfoRatio] = useState(DEFAULT_INFO_RATIO)
  const [summaryHeight, setSummaryHeight] = useState<number | null>(null)
  const [fileChoice, setFileChoice] = useState<{ hash: string | null; index: number }>({ hash: null, index: 0 })
  const sections = useMemo(() => splitPatch(detail?.patch ?? ''), [detail?.patch])
  const innerRef = useRef<HTMLDivElement | null>(null)
  const infoRef = useRef<HTMLDivElement | null>(null)
  const summaryRef = useRef<HTMLDivElement | null>(null)
  const splitStart = useRef({ ratio: DEFAULT_INFO_RATIO, width: 0 })
  const summaryStart = useRef({ height: 0, max: 0 })

  const startSplit = (): void => {
    splitStart.current = {
      ratio: infoRatio,
      width: innerRef.current?.getBoundingClientRect().width ?? 0,
    }
  }

  const resizeSplit = (deltaX: number): void => {
    const width = splitStart.current.width
    if (width <= 0) return
    const min = Math.max(0.24, Math.min(0.5, MIN_INFO_PX / width))
    const max = Math.min(0.78, Math.max(min + 0.1, 1 - MIN_INFO_PX / width))
    setInfoRatio(clamp(splitStart.current.ratio + deltaX / width, min, max))
  }

  const startSummarySplit = (): void => {
    const height = summaryRef.current?.getBoundingClientRect().height ?? 0
    const infoHeight = infoRef.current?.clientHeight ?? 0
    summaryStart.current = { height, max: Math.max(height, infoHeight - 200) }
  }

  const resizeSummarySplit = (_deltaX: number, deltaY: number): void => {
    setSummaryHeight(clamp(summaryStart.current.height + deltaY, 80, summaryStart.current.max))
  }

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
      </div>
    )
  }

  // The first changed file is selected for every commit. Storing the hash with
  // the choice makes a new commit fall back to the first file without an effect.
  const selectedFile = fileChoice.hash === detail.hash ? fileChoice.index : 0
  const activeFile = detail.files[selectedFile]
  const activeSection = sections[selectedFile]

  const innerStyle: React.CSSProperties = {
    gridTemplateColumns: `${infoRatio * 100}% 6px minmax(0, 1fr)`,
  }

  const summaryStyle: React.CSSProperties | undefined = summaryHeight === null
    ? undefined
    : { flexBasis: `${summaryHeight}px`, flexGrow: 0 }

  return (
    <div key={detail.hash} ref={innerRef} className="dsh-gitlog-detail-inner" style={innerStyle}>
      <div ref={infoRef} className="dsh-gitlog-detail-info">
        <div ref={summaryRef} className="dsh-gitlog-detail-summary" style={summaryStyle}>
          <dl className="dsh-gitlog-meta-grid">
            <dt>{t('author')}</dt>
            <dd>{`${detail.author} <${detail.email}>`}</dd>
            <dt>{t('date')}</dt>
            <dd>{formatDate(detail.date)}</dd>
            <dt>{t('commit')}</dt>
            <dd className="dsh-gitlog-detail-commit">
              <code className="dsh-gitlog-hash">{detail.shortHash}</code>
              {detail.parents.length > 1
                ? <span className="dsh-gitlog-merge">{t('merge')}</span>
                : null}
            </dd>
            <dt>{t('parents')}</dt>
            <dd>{detail.parents.length === 0 ? t('rootCommit') : detail.parents.map(parent => parent.slice(0, 12)).join(', ')}</dd>
            <dt>{t('localRemoteBranches')}</dt>
            <dd><Refs refs={detail.refs} /></dd>
            <dt>{t('commitMessage')}</dt>
            <dd className="dsh-gitlog-detail-message">
              <div className="dsh-gitlog-detail-subject">{detail.subject || t('noSubject')}</div>
              {detail.body === '' ? null : <pre className="dsh-gitlog-detail-body">{detail.body}</pre>}
            </dd>
          </dl>
        </div>
        <Splitter
          orientation="horizontal"
          className="dsh-gitlog-detail-summary-split"
          label={t('resizeSummary')}
          onStart={startSummarySplit}
          onDrag={resizeSummarySplit}
        />
        <div className="dsh-gitlog-detail-files">
          <h3>{`${t('changedFiles')}(${detail.files.length})`}</h3>
          {detail.files.length === 0
            ? <p className="dsh-gitlog-note">{t('noPatch')}</p>
            : (
                <ul className="dsh-gitlog-files">
                  {detail.files.map((file, index) => (
                    <li key={file.path}>
                      <button
                        type="button"
                        className={`dsh-gitlog-file${index === selectedFile ? ' is-selected' : ''}`}
                        aria-pressed={index === selectedFile}
                        title={file.path}
                        onClick={() => setFileChoice({ hash: detail.hash, index })}
                      >
                        <span className="dsh-gitlog-file-path">{file.path}</span>
                        {file.binary
                          ? <span className="dsh-gitlog-binary">{t('binary')}</span>
                          : <span className="dsh-gitlog-add">{`+${file.additions ?? 0}`}</span>}
                        {file.binary ? <span /> : <span className="dsh-gitlog-del">{`-${file.deletions ?? 0}`}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
        </div>
      </div>
      <Splitter
        orientation="vertical"
        label={t('resizePatch')}
        onStart={startSplit}
        onDrag={resizeSplit}
      />
      <div className="dsh-gitlog-detail-patch">
        <div className="dsh-gitlog-detail-patch-head">
          <h3>{t('patch')}</h3>
          {activeFile !== undefined
            ? <code className="dsh-gitlog-patch-file" title={activeFile.path}>{activeFile.path}</code>
            : null}
        </div>
        {detail.files.length === 0
          ? <p className="dsh-gitlog-note">{t('noPatch')}</p>
          : activeSection !== undefined
            ? <pre key={`${detail.hash}:${selectedFile}`} className="dsh-gitlog-patch" spellCheck={false}>{activeSection}</pre>
            : <p className="dsh-gitlog-note">{detail.patchTruncated ? t('patchTruncated') : t('fileNoPatch')}</p>}
        {detail.patchTruncated && activeSection !== undefined
          ? <p className="dsh-gitlog-note">{t('patchTruncated')}</p>
          : null}
      </div>
    </div>
  )
}

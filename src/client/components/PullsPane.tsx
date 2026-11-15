import type * as React from 'react'
import { h, useEffect, useRef, useState } from '../runtime.js'
import type { PullsView } from '../hooks/usePulls.js'
import { formatDateTime } from '../lib/format.js'
import { forgeLabel } from '../lib/forge.js'
import { useDiffMode } from '../lib/use-diff-mode.js'
import { useSplitSize } from '../lib/use-split-size.js'
import { readRepoUiState, writeRepoUiState } from '../lib/ui-state.js'
import type { PullFile, PullSummary, Translate } from '../types.js'
import { Button } from './Button.js'
import { DiffView } from './DiffView.js'
import { Dropdown } from './Dropdown.js'
import { ForgeAuthDialog } from './ForgeAuthDialog.js'
import { RefreshIcon, SplitDiffIcon, UnifiedDiffIcon } from './GitLogIcon.js'
import { LoadingLine } from './States.js'
import { Splitter } from './Splitter.js'
import { Switch } from './Switch.js'
import { tooltipProps } from './Tooltip.js'

export interface PullsPaneProps {
  view: PullsView
  t: Translate
  /** Sidebar/narrow layout: the list sits above the detail. */
  narrow: boolean
  /** Repository key used to persist the splitter sizes. */
  repoKey: string
}

function statusLabel(status: string, t: Translate): string {
  if (status === 'added') return t('statusAdded')
  if (status === 'deleted') return t('statusDeleted')
  if (status === 'renamed') return t('statusRenamed')
  if (status === 'copied') return t('statusCopied')
  return t('statusModified')
}

function statusLetter(status: string): string {
  if (status === 'added') return 'A'
  if (status === 'deleted') return 'D'
  if (status === 'renamed') return 'R'
  if (status === 'copied') return 'C'
  return 'M'
}

/** Add the file headers the forge patches omit, so DiffView can number lines. */
function patchText(file: PullFile): string {
  if (file.patch === '') return ''
  if (file.patch.startsWith('diff --git ') || file.patch.startsWith('--- ')) return file.patch
  return `diff --git a/${file.path} b/${file.path}\n--- a/${file.path}\n+++ b/${file.path}\n${file.patch}`
}

function PullBadge({ pull, t }: { pull: PullSummary; t: Translate }): React.ReactElement {
  if (pull.draft) return <span className="dsh-gitlog-pull-badge is-draft">{t('pullDraft')}</span>
  const label = pull.state === 'merged'
    ? t('pullStateMerged')
    : pull.state === 'closed'
      ? t('pullStateClosed')
      : t('pullStateOpen')
  return <span className={`dsh-gitlog-pull-badge is-${pull.state}`}>{label}</span>
}

function PullDetail({ view, t }: { view: PullsView; t: Translate }): React.ReactElement {
  const [fileIndex, setFileIndex] = useState(0)
  const diffMode = useDiffMode()
  const pull = view.detail
  const locale = t('localeId')

  useEffect(() => {
    setFileIndex(0)
  }, [pull?.number, pull?.webUrl])

  if (view.detailStatus === 'loading') return <LoadingLine label={t('pullLoading')} />
  if (view.detailStatus === 'error') {
    return (
      <div className="dsh-gitlog-pulls-error" role="alert">
        <p>{t('pullDetailFailed')}</p>
        <p className="dsh-gitlog-error-code">{view.detailError?.message ?? ''}</p>
        {view.selected === null ? null : (
          <Button variant="ghost" onClick={() => view.selectPull(view.selected ?? 0)}>{t('tryAgain')}</Button>
        )}
      </div>
    )
  }
  if (pull === null) return <p className="dsh-gitlog-pulls-hint">{t('pullSelectHint')}</p>

  const file = pull.files[fileIndex]
  const webUrl = /^https?:\/\//i.test(pull.webUrl) ? pull.webUrl : ''
  const counts: string[] = []
  if (pull.additions !== null) counts.push(`+${pull.additions}`)
  if (pull.deletions !== null) counts.push(`−${pull.deletions}`)

  return (
    <div className="dsh-gitlog-pull-content">
      <header className="dsh-gitlog-pull-head">
        <div className="dsh-gitlog-pull-headline">
          <h2>
            <span className="dsh-gitlog-pull-number">{`#${pull.number}`}</span>
            {pull.title}
          </h2>
          <PullBadge pull={pull} t={t} />
        </div>
        <p className="dsh-gitlog-pull-head-meta">
          <span>{pull.author === '' ? '—' : pull.author}</span>
          <span>{`${pull.sourceBranch} → ${pull.targetBranch}`}</span>
          <span>{`${t('pullUpdated')} ${formatDateTime(pull.updatedAt, locale)}`}</span>
          {counts.length === 0 ? null : <span className="dsh-gitlog-pull-counts">{counts.join(' ')}</span>}
        </p>
        <div className="dsh-gitlog-pull-actions">
          {webUrl === ''
            ? null
            : (
                <a
                  className="dsh-gitlog-btn"
                  href={webUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {t('pullOpenBrowser')}
                </a>
              )}
          <Button
            variant="primary"
            loading={view.checkingOut === pull.number}
            onClick={() => { void view.checkout(pull.number) }}
          >
            {view.checkingOut === pull.number ? t('pullCheckingOut') : t('pullCheckout')}
          </Button>
        </div>
      </header>

      <section className="dsh-gitlog-pull-section">
        <h3>{t('pullDescription')}</h3>
        <pre className="dsh-gitlog-pull-body">{pull.body.trim() === '' ? t('pullNoBody') : pull.body}</pre>
      </section>

      <section className="dsh-gitlog-pull-section">
        <h3>{`${t('pullFiles')} (${pull.changedFiles ?? pull.files.length})`}</h3>
        {pull.files.length === 0
          ? <p className="dsh-gitlog-note">{t('pullNoFiles')}</p>
          : (
              <div className="dsh-gitlog-pull-files-wrap">
                <div className="dsh-gitlog-pull-files">
                  {pull.files.map((item, index) => (
                    <button
                      key={`${item.path}:${String(index)}`}
                      type="button"
                      className={`dsh-gitlog-pull-file${index === fileIndex ? ' is-selected' : ''}`}
                      onClick={() => setFileIndex(index)}
                    >
                      <span
                        className={`dsh-gitlog-pull-file-status is-${item.status}`}
                        {...tooltipProps(statusLabel(item.status, t))}
                      >
                        {statusLetter(item.status)}
                      </span>
                      <span className="dsh-gitlog-pull-file-path">{item.path}</span>
                      {item.additions === null ? null : <span className="dsh-gitlog-pull-file-add">{`+${item.additions}`}</span>}
                      {item.deletions === null ? null : <span className="dsh-gitlog-pull-file-del">{`−${item.deletions}`}</span>}
                    </button>
                  ))}
                </div>
                {file === undefined
                  ? null
                  : file.binary || file.patch === ''
                    ? <p className="dsh-gitlog-note">{t('pullBinary')}</p>
                    : (
                        <div className="dsh-gitlog-pulls-patch">
                          <div className="dsh-gitlog-pull-patch-head">
                            <code className="dsh-gitlog-patch-file" {...tooltipProps(file.path)}>{file.path}</code>
                            <button
                              type="button"
                              className="dsh-gitlog-diff-mode"
                              aria-label={diffMode.mode === 'split' ? t('diffUnified') : t('diffSplit')}
                              {...tooltipProps(diffMode.mode === 'split' ? t('diffUnified') : t('diffSplit'))}
                              onClick={diffMode.toggle}
                            >
                              {diffMode.mode === 'split' ? <UnifiedDiffIcon /> : <SplitDiffIcon />}
                            </button>
                          </div>
                          <DiffView
                            key={`${pull.number}:${file.path}`}
                            patch={patchText(file)}
                            path={file.path}
                            t={t}
                            empty={t('pullBinary')}
                            mode={diffMode.mode}
                          />
                        </div>
                      )}
                {pull.filesTruncated ? <p className="dsh-gitlog-note">{t('pullFilesTruncated')}</p> : null}
              </div>
            )}
      </section>

      <section className="dsh-gitlog-pull-section">
        <h3>{`${t('pullCommits')} (${pull.commits.length})`}</h3>
        {pull.commits.length === 0
          ? null
          : (
              <div className="dsh-gitlog-pull-commits">
                {pull.commits.map(commit => (
                  <div key={commit.hash} className="dsh-gitlog-pull-commit">
                    <code>{commit.shortHash}</code>
                    <span className="dsh-gitlog-pull-commit-subject">{commit.subject}</span>
                    <span className="dsh-gitlog-pull-commit-meta">{commit.author}</span>
                    <span className="dsh-gitlog-pull-commit-meta">{formatDateTime(commit.date, locale)}</span>
                  </div>
                ))}
              </div>
            )}
      </section>
    </div>
  )
}

/** The PR view: a remote and state filter, the request list, and the detail. */
export function PullsPane({ view, t, narrow, repoKey }: PullsPaneProps): React.ReactElement {
  const forge = view.remotes.find(item => item.name === view.remote)?.forge ?? null
  const bodyRef = useRef<HTMLDivElement | null>(null)

  const listWidth = useSplitSize({
    initial: () => Math.min(720, Math.max(220, readRepoUiState(repoKey).pullsListWidth ?? 320)),
    min: 220,
    max: () => {
      const width = bodyRef.current?.getBoundingClientRect().width ?? 0
      return width <= 0 ? 720 : Math.max(240, Math.min(720, width - 300))
    },
    axis: 'x',
    persist: value => writeRepoUiState({ pullsListWidth: value }, repoKey),
  })
  const listHeight = useSplitSize({
    initial: () => Math.min(520, Math.max(140, readRepoUiState(repoKey).pullsListHeight ?? 220)),
    min: 140,
    max: () => {
      const height = bodyRef.current?.getBoundingClientRect().height ?? 0
      return height <= 0 ? 520 : Math.max(160, Math.min(520, height - 220))
    },
    axis: 'y',
    persist: value => writeRepoUiState({ pullsListHeight: value }, repoKey),
  })
  const listSize = narrow ? listHeight : listWidth
  const bodyStyle = {
    '--gitlog-pulls-w': `${listWidth.size}px`,
    '--gitlog-pulls-h': `${listHeight.size}px`,
  } as unknown as React.CSSProperties

  return (
    <div className="dsh-gitlog-pulls">
      <div className="dsh-gitlog-pulls-toolbar">
        {view.remotes.length > 1
          ? (
              <Dropdown
                className="dsh-gitlog-pulls-remote"
                value={view.remote}
                options={view.remotes.map(item => ({ value: item.name, label: item.name, title: item.name }))}
                onChange={view.selectRemote}
                ariaLabel={t('pullRemote')}
              />
            )
          : null}
        <Switch
          value={view.state}
          ariaLabel={t('pullFilter')}
          options={[
            { value: 'open' as const, label: t('pullOpen') },
            { value: 'all' as const, label: t('pullAll') },
          ]}
          onChange={view.setState}
        />
        <div className="dsh-gitlog-pulls-end">
          {forge === null
            ? null
            : (
                <span className="dsh-gitlog-pulls-forge">
                  <span className="dsh-gitlog-pulls-provider">{forgeLabel(forge.provider)}</span>
                  <span className="dsh-gitlog-pulls-repo">{`${forge.owner}/${forge.repo}`}</span>
                </span>
              )}
          <Button
            variant="ghost"
            iconOnly
            title={t('refresh')}
            disabled={view.status === 'loading'}
            onClick={view.refresh}
            icon={<RefreshIcon size={16} />}
          />
        </div>
      </div>

      <div
        ref={bodyRef}
        className={`dsh-gitlog-pulls-body${narrow ? ' is-narrow' : ''}`}
        style={bodyStyle}
      >
        <div className="dsh-gitlog-pulls-list" role="listbox" aria-label={t('pulls')}>
          {view.status === 'loading' && view.pulls.length === 0
            ? <LoadingLine label={t('pullLoading')} />
            : null}
          {view.status === 'error'
            ? (
                <div className="dsh-gitlog-pulls-error" role="alert">
                  <p>{t('pullFailed')}</p>
                  <p className="dsh-gitlog-error-code">{view.error?.message ?? ''}</p>
                  {view.error?.code === 'forge-rate-limited' || view.error?.code === 'forge-not-found'
                    ? <p className="dsh-gitlog-note">{t('pullAuthHint')}</p>
                    : null}
                  <Button variant="ghost" onClick={view.refresh}>{t('tryAgain')}</Button>
                </div>
              )
            : null}
          {view.status === 'ready' && view.pulls.length === 0
            ? <p className="dsh-gitlog-pulls-empty">{t(view.state === 'all' ? 'pullEmptyAll' : 'pullEmpty')}</p>
            : null}
          {view.pulls.map(pull => (
            <button
              key={pull.number}
              type="button"
              role="option"
              aria-selected={view.selected === pull.number}
              className={`dsh-gitlog-pull${view.selected === pull.number ? ' is-selected' : ''}`}
              onClick={() => view.selectPull(pull.number)}
            >
              <span className="dsh-gitlog-pull-line">
                <span className="dsh-gitlog-pull-number">{`#${pull.number}`}</span>
                <span className="dsh-gitlog-pull-title">{pull.title}</span>
                <PullBadge pull={pull} t={t} />
              </span>
              <span className="dsh-gitlog-pull-meta">
                <span>{pull.author === '' ? '—' : pull.author}</span>
                <span>{`${pull.sourceBranch} → ${pull.targetBranch}`}</span>
                <span>{`${t('pullUpdated')} ${formatDateTime(pull.updatedAt, t('localeId'))}`}</span>
              </span>
            </button>
          ))}
          {view.hasMore && view.status === 'ready'
            ? <p className="dsh-gitlog-pulls-note">{t('pullMore')}</p>
            : null}
        </div>
        <Splitter
          orientation={narrow ? 'horizontal' : 'vertical'}
          label={t('resizePullList')}
          onStart={listSize.start}
          onDrag={listSize.drag}
          onReset={listSize.reset}
        />
        <div className="dsh-gitlog-pulls-detail">
          <PullDetail view={view} t={t} />
        </div>
      </div>

      {view.authPrompt === null
        ? null
        : (
            <ForgeAuthDialog
              prompt={view.authPrompt}
              busy={view.authBusy}
              error={view.authError}
              t={t}
              onSubmit={(username, token) => { void view.submitToken(username, token) }}
              onClose={view.dismissAuth}
            />
          )}
    </div>
  )
}

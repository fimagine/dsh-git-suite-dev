import type * as React from 'react'
import { h, useState } from '../runtime.js'
import type { PullsView } from '../hooks/usePulls.js'
import type { PullDetail, Translate } from '../types.js'
import { Button, DialogActions } from './Button.js'
import { DialogShell } from './DialogShell.js'
import { Dropdown } from './Dropdown.js'
import { PullChecksBadge } from './PullChecksBadge.js'
import { PullReviewBadge } from './PullReviewBadge.js'

export interface MergePullDialogProps {
  view: PullsView
  pull: PullDetail
  t: Translate
  onClose(): void
}

/** Merges the selected request with a method and optional branch deletion. */
export function MergePullDialog({ view, pull, t, onClose }: MergePullDialogProps): React.ReactElement {
  const provider = view.remotes.find(item => item.name === view.remote)?.forge?.provider ?? ''
  const forge = view.remotes.find(item => item.name === view.remote)?.forge ?? null
  const repo = forge === null ? '' : `${forge.owner}/${forge.repo}`
  const webUrl = /^https?:\/\//i.test(pull.webUrl) ? pull.webUrl : ''
  const methods: Array<'merge' | 'squash' | 'rebase'> = provider === 'github'
    ? ['merge', 'squash', 'rebase']
    : ['merge', 'squash']
  const [method, setMethod] = useState<'merge' | 'squash' | 'rebase'>('merge')
  const [deleteSourceBranch, setDeleteSourceBranch] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const blocked = pull.mergeable === false
  const failing = pull.checks?.state === 'failure'

  const approve = async (action: 'review' | 'test'): Promise<void> => {
    setApprovalError(null)
    const message = await view.decideGitee(action)
    if (message !== null) setApprovalError(message)
  }

  const submit = async (): Promise<void> => {
    if (busy || blocked) return
    setBusy(true)
    setError(null)
    const message = await view.mergePull({ method, deleteSourceBranch })
    if (message === null) {
      onClose()
      return
    }
    setError(message)
    setBusy(false)
  }

  return (
    <DialogShell title={t('pullMergeTitle')} t={t} onClose={onClose}>
      <div className="dsh-gitlog-pull-merge">
        <p className="dsh-gitlog-note">{`${repo === '' ? '' : `${repo} · `}#${pull.number} · ${pull.title}`}</p>
        <div className="dsh-gitlog-pull-merge-meta">
          <PullChecksBadge checks={pull.checks} t={t} />
          <PullReviewBadge review={pull.review ?? null} t={t} />
          {blocked ? <span className="dsh-gitlog-pull-merge-warning">{t('pullMergeBlocked')}</span> : null}
          {failing ? <span className="dsh-gitlog-pull-merge-warning">{t('pullMergeChecksFailing')}</span> : null}
        </div>
        {provider === 'gitee'
          ? (
              <div className="dsh-gitlog-merge-approvals">
                <p className="dsh-gitlog-field-hint">{t('pullGiteeApprovalsHint')}</p>
                <div className="dsh-gitlog-merge-approval-actions">
                  <Button
                    loading={view.giteeDecision === 'review'}
                    disabled={busy || view.giteeDecision !== null}
                    onClick={() => { void approve('review') }}
                  >
                    {t('pullGiteeReview')}
                  </Button>
                  <Button
                    loading={view.giteeDecision === 'test'}
                    disabled={busy || view.giteeDecision !== null}
                    onClick={() => { void approve('test') }}
                  >
                    {t('pullGiteeTest')}
                  </Button>
                </div>
                {approvalError === null
                  ? null
                  : <p className="dsh-gitlog-note" role="alert">{approvalError}</p>}
              </div>
            )
          : null}
        <label className="dsh-gitlog-field">
          <span>{t('pullMergeMethod')}</span>
          <Dropdown
            value={method}
            options={methods.map(value => ({
              value,
              label: value === 'merge'
                ? t('pullMergeMethodMerge')
                : value === 'squash'
                  ? t('pullMergeMethodSquash')
                  : t('pullMergeMethodRebase'),
            }))}
            onChange={value => setMethod(value as 'merge' | 'squash' | 'rebase')}
            ariaLabel={t('pullMergeMethod')}
          />
        </label>
        <label className="dsh-gitlog-check">
          <input
            type="checkbox"
            checked={deleteSourceBranch}
            onChange={event => setDeleteSourceBranch(event.target.checked)}
          />
          {t('pullMergeDeleteBranch')}
        </label>
        <p className="dsh-gitlog-field-hint">{t('pullMergeHint')}</p>
        {webUrl === ''
          ? null
          : (
              <p className="dsh-gitlog-field-hint">
                <a href={webUrl} target="_blank" rel="noreferrer noopener">{t('pullOpenBrowser')}</a>
              </p>
            )}
      </div>
      {error === null ? null : <p className="dsh-gitlog-note" role="alert">{error}</p>}
      <DialogActions>
        <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
        <Button
          variant="primary"
          disabled={busy || blocked || view.giteeDecision !== null}
          onClick={() => { void submit() }}
        >
          {busy ? t('pullMerging') : t('pullMergeAction')}
        </Button>
      </DialogActions>
    </DialogShell>
  )
}

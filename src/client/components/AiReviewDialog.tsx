import type * as React from 'react'
import { h, useState } from '../runtime.js'
import type { PullsView } from '../hooks/usePulls.js'
import type { AiReviewMode, Translate } from '../types.js'
import { Button, DialogActions } from './Button.js'
import { DialogShell } from './DialogShell.js'

export interface AiReviewDialogProps {
  view: PullsView
  t: Translate
  onClose(): void
}

const MODES = [
  { value: 'worktree', label: 'pullAiReviewModeWorktree', hint: 'pullAiReviewModeWorktreeHint' },
  { value: 'api', label: 'pullAiReviewModeApi', hint: 'pullAiReviewModeApiHint' },
  { value: 'diff', label: 'pullAiReviewModeDiff', hint: 'pullAiReviewModeDiffHint' },
] as const

/** Asks how much file context to send before starting an AI review. */
export function AiReviewDialog({ view, t, onClose }: AiReviewDialogProps): React.ReactElement {
  const [mode, setMode] = useState<AiReviewMode>(view.aiReviewMode)
  const [radioName] = useState(() => `dsh-gitlog-ai-mode-${Math.random().toString(36).slice(2)}`)

  const start = (): void => {
    view.setAiReviewMode(mode)
    view.runAiReview(mode)
    onClose()
  }

  return (
    <DialogShell title={t('pullAiReviewTitle')} t={t} onClose={onClose}>
      <p className="dsh-gitlog-note">{t('pullAiReviewDialogHint')}</p>
      <div className="dsh-gitlog-ai-options">
        {MODES.map(option => (
          <label
            key={option.value}
            className={`dsh-gitlog-ai-option${mode === option.value ? ' is-selected' : ''}`}
          >
            <input
              type="radio"
              name={radioName}
              value={option.value}
              checked={mode === option.value}
              onChange={() => setMode(option.value)}
            />
            <span className="dsh-gitlog-ai-option-text">
              <span className="dsh-gitlog-ai-option-label">{t(option.label)}</span>
              <span className="dsh-gitlog-ai-option-hint">{t(option.hint)}</span>
            </span>
          </label>
        ))}
      </div>
      <DialogActions>
        <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
        <Button variant="primary" onClick={start}>{t('pullAiReviewStart')}</Button>
      </DialogActions>
    </DialogShell>
  )
}

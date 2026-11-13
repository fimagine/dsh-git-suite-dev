import type * as React from 'react'
import { h, useEffect, useRef, useState } from '../runtime.js'
import type { GitLogView } from '../hooks/useGitLogView.js'
import { requestBranch, requestCheckout, requestTag, toApiError } from '../lib/api.js'
import type { Branch, Commit, Translate } from '../types.js'
import { DialogShell } from './DialogShell.js'
import { Button, DialogActions } from './Button.js'

export interface CommitContext {
  commit: Commit
  x: number
  y: number
}

interface CommitDialogProps {
  view: GitLogView
  commit: Commit
  t: Translate
  onClose(): void
}

function sameHash(left: string, right: string): boolean {
  if (left === '' || right === '') return false
  return left.startsWith(right) || right.startsWith(left)
}

function localBranchesAt(view: GitLogView, commit: Commit): Branch[] {
  return (view.tree?.branches ?? []).filter(branch => branch.kind === 'local' && sameHash(branch.hash, commit.hash))
}

function repoPath(view: GitLogView): string {
  return view.repo?.repoRoot ?? view.pathInput.trim()
}

function CommitTarget({ commit }: { commit: Commit }): React.ReactElement {
  return (
    <p className="dsh-gitlog-dialog-target">
      <code>{commit.shortHash}</code>
      <span>{commit.subject}</span>
    </p>
  )
}

function TagDialog({ view, commit, t, onClose }: CommitDialogProps): React.ReactElement {
  const existing = commit.refs.filter(ref => ref.startsWith('tag: ')).map(ref => ref.slice(5))
  const [name, setName] = useState(existing[0] ?? '')
  const [message, setMessage] = useState('')
  const [force, setForce] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const tag = name.trim()
    if (tag === '') {
      setError(t('tagNameRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await requestTag({
        path: repoPath(view),
        hash: commit.hash,
        name: tag,
        ...(message.trim() === '' ? {} : { message: message.trim() }),
        force,
      })
      view.refresh()
      onClose()
    } catch (failure) {
      setError(toApiError(failure).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogShell title={t('tagDialogTitle')} t={t} onClose={onClose}>
      <form className="dsh-gitlog-repo-form" onSubmit={event => { void submit(event) }}>
        <CommitTarget commit={commit} />
        <label className="dsh-gitlog-field">
          <span>{t('tagName')}</span>
          <input
            type="text"
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder={t('tagNamePlaceholder')}
            spellCheck={false}
            autoComplete="off"
            autoFocus
          />
        </label>
        <label className="dsh-gitlog-field">
          <span>{t('tagMessage')}</span>
          <textarea
            className="dsh-gitlog-workspace-message"
            value={message}
            onChange={event => setMessage(event.target.value)}
            placeholder={t('tagMessagePlaceholder')}
            rows={3}
            spellCheck={false}
          />
        </label>
        <label className="dsh-gitlog-check">
          <input
            type="checkbox"
            checked={force}
            onChange={event => setForce(event.target.checked)}
          />
          {t('tagForce')}
        </label>
        {error === null ? null : <p className="dsh-gitlog-note" role="alert">{error}</p>}
        <DialogActions className="dsh-gitlog-settings-actions">
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? t('tagSaving') : t('tagSave')}
          </Button>
        </DialogActions>
      </form>
    </DialogShell>
  )
}

function BranchDialog({ view, commit, t, onClose }: CommitDialogProps): React.ReactElement {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const branch = name.trim()
    if (branch === '') {
      setError(t('branchNameRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await requestBranch({ path: repoPath(view), hash: commit.hash, name: branch })
      view.refresh()
      onClose()
    } catch (failure) {
      setError(toApiError(failure).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogShell title={t('branchDialogTitle')} t={t} onClose={onClose}>
      <form className="dsh-gitlog-repo-form" onSubmit={event => { void submit(event) }}>
        <CommitTarget commit={commit} />
        <label className="dsh-gitlog-field">
          <span>{t('branchName')}</span>
          <input
            type="text"
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder={t('branchNamePlaceholder')}
            spellCheck={false}
            autoComplete="off"
            autoFocus
          />
        </label>
        {error === null ? null : <p className="dsh-gitlog-note" role="alert">{error}</p>}
        <DialogActions className="dsh-gitlog-settings-actions">
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? t('branchSaving') : t('branchCreate')}
          </Button>
        </DialogActions>
      </form>
    </DialogShell>
  )
}

function CheckoutDialog({ view, commit, t, onClose }: CommitDialogProps): React.ReactElement {
  const branches = localBranchesAt(view, commit)
  const [target, setTarget] = useState(branches[0]?.name ?? 'detached')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const detached = target === 'detached'

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await requestCheckout({
        path: repoPath(view),
        ...(detached ? { hash: commit.hash } : { branch: target }),
      })
      view.selectRef({ kind: 'head' })
      view.refresh()
      onClose()
    } catch (failure) {
      setError(toApiError(failure).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogShell title={t('checkoutDialogTitle')} t={t} onClose={onClose}>
      <form className="dsh-gitlog-repo-form" onSubmit={event => { void submit(event) }}>
        <CommitTarget commit={commit} />
        <fieldset className="dsh-gitlog-checkout-options">
          <legend>{t('checkoutTarget')}</legend>
          <label>
            <input
              type="radio"
              name="checkout-target"
              checked={detached}
              onChange={() => setTarget('detached')}
            />
            {t('checkoutDetached')}
          </label>
          {branches.map(branch => (
            <label key={branch.name}>
              <input
                type="radio"
                name="checkout-target"
                checked={target === branch.name}
                onChange={() => setTarget(branch.name)}
              />
              {t('checkoutBranch')} <code>{branch.name}</code>
            </label>
          ))}
        </fieldset>
        <p className="dsh-gitlog-warning" role="alert">
          {detached
            ? t('checkoutWarningDetached')
            : t('checkoutWarningBranch').replace('{name}', target)}
        </p>
        {error === null ? null : <p className="dsh-gitlog-note" role="alert">{error}</p>}
        <DialogActions className="dsh-gitlog-settings-actions">
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? t('checkingOut') : t('checkoutConfirm')}
          </Button>
        </DialogActions>
      </form>
    </DialogShell>
  )
}

/** Right-click menu for a commit: tag, branch, and a warned checkout. */
export function CommitActions({ view, context, t, onClose }: {
  view: GitLogView
  context: CommitContext | null
  t: Translate
  onClose(): void
}): React.ReactElement | null {
  const [dialog, setDialog] = useState<'tag' | 'branch' | 'checkout' | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const close = (): void => {
    setDialog(null)
    onClose()
  }

  useEffect(() => {
    if (context === null || dialog !== null) return undefined
    const onPointerDown = (event: MouseEvent): void => {
      if (menuRef.current !== null && !menuRef.current.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [context, dialog, onClose])

  if (context === null) return null
  const { commit } = context

  if (dialog === 'tag') return <TagDialog view={view} commit={commit} t={t} onClose={close} />
  if (dialog === 'branch') return <BranchDialog view={view} commit={commit} t={t} onClose={close} />
  if (dialog === 'checkout') return <CheckoutDialog view={view} commit={commit} t={t} onClose={close} />

  const left = Math.min(context.x, window.innerWidth - 180)
  const top = Math.min(context.y, window.innerHeight - 140)
  return (
    <div
      ref={menuRef}
      className="dsh-gitlog-commit-menu"
      style={{ left, top }}
      role="menu"
      aria-label={t('commitMenu')}
    >
      <button type="button" role="menuitem" onClick={() => setDialog('tag')}>{t('commitTag')}</button>
      <button type="button" role="menuitem" onClick={() => setDialog('branch')}>{t('commitBranch')}</button>
      <button type="button" role="menuitem" onClick={() => setDialog('checkout')}>{t('commitCheckout')}</button>
    </div>
  )
}

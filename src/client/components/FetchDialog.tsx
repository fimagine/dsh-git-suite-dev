import type * as React from 'react'
import { h, useState } from '../runtime.js'
import type { WorkspaceView } from '../hooks/useWorkspace.js'
import type { Translate } from '../types.js'
import { DialogShell } from './DialogShell.js'

export interface FetchDialogProps {
  ws: WorkspaceView
  t: Translate
  onClose(): void
}

/** Fetch options mirroring the desktop client: all remotes, prune, tags, force tags. */
export function FetchDialog({ ws, t, onClose }: FetchDialogProps): React.ReactElement {
  const [fetchAll, setFetchAll] = useState(true)
  const [prune, setPrune] = useState(true)
  const [tags, setTags] = useState(true)
  const [forceTags, setForceTags] = useState(false)

  const option = (
    checked: boolean,
    onChange: (value: boolean) => void,
    label: string,
  ): React.ReactElement => (
    <label className="dsh-gitlog-check dsh-gitlog-fetch-option">
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )

  return (
    <DialogShell title={t('fetch')} t={t} onClose={onClose}>
      <div className="dsh-gitlog-fetch-options">
        {option(fetchAll, setFetchAll, t('fetchAllRemotes'))}
        {option(prune, setPrune, t('pruneTracking'))}
        <div className="dsh-gitlog-fetch-tags">
          {option(tags, setTags, t('fetchAllTags'))}
          {option(forceTags, setForceTags, t('forceTags'))}
        </div>
      </div>
      <div className="dsh-gitlog-dialog-actions">
        <button type="button" className="dsh-gitlog-btn" onClick={onClose}>{t('cancel')}</button>
        <button
          type="button"
          className="dsh-gitlog-btn primary"
          disabled={ws.syncState === 'loading'}
          onClick={() => {
            ws.sync('fetch', undefined, { fetchAll, prune, tags, forceTags })
            onClose()
          }}
        >
          {t('ok')}
        </button>
      </div>
    </DialogShell>
  )
}

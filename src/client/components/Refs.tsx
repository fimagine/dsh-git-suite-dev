import type * as React from 'react'
import { h } from '../runtime.js'
import { tooltipProps } from './Tooltip.js'

export interface RefsProps {
  refs: readonly string[]
  /**
   * Right-click on one decoration. Return `true` when the menu was opened so the
   * chip can keep the event away from the commit row's own context menu.
   */
  onRefContextMenu?(ref: string, event: React.MouseEvent): boolean
}

/** Branch and tag decorations attached to a commit row. */
export function Refs({ refs, onRefContextMenu }: RefsProps): React.ReactElement | null {
  if (refs.length === 0) return null
  return (
    <span className="dsh-gitlog-refs">
      {refs.map(ref => (
        <span
          key={ref}
          className={`dsh-gitlog-ref${ref.startsWith('HEAD') ? ' is-head' : ''}`}
          onContextMenu={onRefContextMenu === undefined
            ? undefined
            : event => {
                if (onRefContextMenu(ref, event) !== true) return
                event.preventDefault()
                event.stopPropagation()
              }}
        >
          {ref}
        </span>
      ))}
    </span>
  )
}



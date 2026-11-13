import type * as React from 'react'
import { GitLogPanel } from './GitLogPanel.js'
import { h } from './runtime.js'
import type { Translate } from './types.js'

/**
 * The right-sidebar tab body. It renders the same panel as the main area, with
 * the sidebar wrapper class that switches to the narrow single-column layout.
 */
export function SidebarGitLogPanel({ t }: { t: Translate }): React.ReactElement {
  return (
    <div className="dsh-gitlog-sidebar">
      <GitLogPanel t={t} compact />
    </div>
  )
}

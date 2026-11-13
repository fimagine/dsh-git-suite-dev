import type * as React from 'react'
import { h } from '../runtime.js'

/** Branch and tag decorations attached to a commit row. */
export function Refs({ refs }: { refs: readonly string[] }): React.ReactElement | null {
  if (refs.length === 0) return null
  return (
    <span className="dsh-gitlog-refs">
      {refs.map(ref => (
        <span
          key={ref}
          className={`dsh-gitlog-ref${ref.startsWith('HEAD') ? ' is-head' : ''}`}
          title={ref}
        >
          {ref}
        </span>
      ))}
    </span>
  )
}

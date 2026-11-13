import type * as React from 'react'
import { h } from '../runtime.js'
import type { IconProps } from '../dsh.js'

/** Sidebar icon: two commit nodes joined by a branch line. */
export function GitLogIcon({ size }: IconProps): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
      focusable={false}
    >
      <circle cx={6.5} cy={5.5} r={2} />
      <circle cx={6.5} cy={18.5} r={2} />
      <circle cx={17.5} cy={8.5} r={2} />
      <path d="M6.5 7.5v9" />
      <path d="M17.5 10.5c0 4-5 4.2-9 4.7" />
    </svg>
  )
}

/** Circular-arrow icon for the refresh buttons. */
export function RefreshIcon({ size = 16 }: { size?: number }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
      focusable={false}
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

/** Sparkle icon for the AI commit-message button. */
export function SparkleIcon({ size = 16 }: { size?: number }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
      focusable={false}
    >
      <path d="M11 3l1.7 4.8L17.5 9.5l-4.8 1.7L11 16l-1.7-4.8L4.5 9.5l4.8-1.7L11 3z" />
      <path d="M18 15l.8 2.2 2.2.8-2.2.8L18 21l-.8-2.2-2.2-.8 2.2-.8L18 15z" />
    </svg>
  )
}

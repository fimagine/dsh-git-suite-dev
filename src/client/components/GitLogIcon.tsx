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

/** Plus glyph for the add-repository button. */
export function PlusIcon({ size = 16 }: { size?: number }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      aria-hidden={true}
      focusable={false}
    >
      <path d="M8 3.2v9.6M3.2 8h9.6" />
    </svg>
  )
}

/** Two opposed arrows: compare with a remote. */
export function CompareIcon({ size = 14 }: { size?: number }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
      focusable={false}
    >
      <path d="M2.5 5.5h9M9.2 3.2 11.5 5.5 9.2 7.8" />
      <path d="M13.5 10.5h-9M6.8 8.2 4.5 10.5l2.3 2.3" />
    </svg>
  )
}

/** Upload arrow: this tag exists only in the local repository. */
export function TagLocalIcon({ size = 12 }: { size?: number }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
      focusable={false}
    >
      <path d="M8 11V3.4M4.9 6.5 8 3.4l3.1 3.1" />
      <path d="M3.2 13h9.6" />
    </svg>
  )
}

/** Inequality mark: the local tag points at a different commit than the remote. */
export function TagDiffIcon({ size = 12 }: { size?: number }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      aria-hidden={true}
      focusable={false}
    >
      <path d="M2.8 5.8h10.4M2.8 10.2h10.4" />
      <path d="M10.6 2.6 5.4 13.4" />
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

function CircleArrow({ direction, dashed = false }: { direction: 'down' | 'up'; dashed?: boolean }): React.ReactElement {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
      focusable={false}
    >
      <circle cx="10" cy="10" r="7.4" strokeDasharray={dashed ? '2.6 2.2' : undefined} />
      {direction === 'down'
        ? <path d="M10 6.2v7.4M7.3 10.9 10 13.6l2.7-2.7" />
        : <path d="M10 13.8V6.4M7.3 9.1 10 6.4l2.7 2.7" />}
    </svg>
  )
}

export function CommitIcon(): React.ReactElement {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
      focusable={false}
    >
      <circle cx="10" cy="10" r="7.4" />
      <path d="M10 6.5v7M6.5 10h7" />
    </svg>
  )
}

export function PullIcon(): React.ReactElement {
  return <CircleArrow direction="down" />
}

export function PushIcon(): React.ReactElement {
  return <CircleArrow direction="up" />
}

export function FetchIcon(): React.ReactElement {
  return <CircleArrow direction="down" dashed />
}

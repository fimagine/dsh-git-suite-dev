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

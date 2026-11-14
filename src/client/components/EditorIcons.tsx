import type * as React from 'react'
import { h } from '../runtime.js'
import { VSCODE_CODICON_PATH, VscodeIcon } from './GitLogIcon.js'

export interface EditorGlyphProps {
  /** Editor id from `mode=apps`. */
  id: string
  size?: number
  strokeWidth?: number
}

/** Shared frame for the hand-drawn editor glyphs. */
function Frame({ size, strokeWidth = 1.7, children }: { size: number; strokeWidth?: number; children?: React.ReactNode }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
      focusable={false}
    >
      {children}
    </svg>
  )
}

/** A rounded square, the badge the JetBrains-style glyphs sit in. */
function Badge(): React.ReactElement {
  return <rect x="3.8" y="3.8" width="16.4" height="16.4" rx="4.4" />
}

/**
 * One glyph per editor the host can detect. These are recognizable-but-simple
 * marks drawn for the toolbar, not official brand artwork; VS Code uses the
 * codicon path the panel already shipped.
 */
export function EditorGlyph({ id, size = 18, strokeWidth }: EditorGlyphProps): React.ReactElement {
  if (id === 'vscode') return <VscodeIcon size={size} />
  if (id === 'vscode-insiders') {
    // Same mark plus an insiders dot in the codicon's own coordinate space.
    return (
      <svg
        width={size}
        height={size}
        viewBox="-1.6 -1.6 19.2 19.2"
        fill="currentColor"
        aria-hidden={true}
        focusable={false}
      >
        <path d={VSCODE_CODICON_PATH} />
        <circle cx="15.4" cy="15.4" r="1.9" />
      </svg>
    )
  }

  switch (id) {
    case 'cursor':
      return (
        <Frame size={size} strokeWidth={strokeWidth}>
          <path d="M6 3.6 18 12l-5.6 1.4L9.6 19z" fill="currentColor" stroke="none" />
        </Frame>
      )
    case 'windsurf':
      return (
        <Frame size={size} strokeWidth={strokeWidth}>
          <path d="M3.5 9h11a3 3 0 1 0-2.6-4.5" />
          <path d="M3.5 14h8a3 3 0 1 1-2.4 4.6" />
        </Frame>
      )
    case 'vscodium':
      return (
        <Frame size={size} strokeWidth={strokeWidth}>
          <Badge />
          <path d="M8.4 9.4 12 15.6l3.6-6.2" />
        </Frame>
      )
    case 'zed':
      return (
        <Frame size={size} strokeWidth={strokeWidth}>
          <path d="M6.6 5.8h10.8L6.6 18.2h10.8" />
        </Frame>
      )
    case 'sublime':
      return (
        <Frame size={size} strokeWidth={strokeWidth}>
          <Badge />
          <path d="M15.4 9.2c-1-1.2-2.8-1.4-4.2-1-1.6.4-2.2 1.6-1.4 2.6.9 1.1 3.4 1.1 4.3 2.1.9 1-.3 2.3-2.5 2.3-1.2 0-2.3-.4-3-1.1" />
        </Frame>
      )
    case 'textmate':
      return (
        <Frame size={size} strokeWidth={strokeWidth}>
          <Badge />
          <path d="M8 9.2h8M12 9.2v6.4" />
        </Frame>
      )
    case 'idea':
      return (
        <Frame size={size} strokeWidth={strokeWidth}>
          <Badge />
          <path d="M8.2 8.6v6.8M13.4 8.6v4.2a2.4 2.4 0 0 1-2.6 2.6" />
        </Frame>
      )
    case 'webstorm':
      return (
        <Frame size={size} strokeWidth={strokeWidth}>
          <Badge />
          <path d="M7.2 9.2 9 15l2-3.6 2 3.6 1.8-5.8" />
        </Frame>
      )
    case 'pycharm':
      return (
        <Frame size={size} strokeWidth={strokeWidth}>
          <Badge />
          <path d="M9.2 16.4V8.4h3.6a3 3 0 0 1 0 6H9.2" />
        </Frame>
      )
    case 'goland':
      return (
        <Frame size={size} strokeWidth={strokeWidth}>
          <Badge />
          <path d="M14.8 9.8A4 4 0 1 0 16 13.2h-2.3" />
        </Frame>
      )
    case 'visualstudio':
      // The VS Code silhouette with the left notch closed into one connected
      // loop, drawn as an outline instead of a filled mark.
      return (
        <Frame size={size} strokeWidth={strokeWidth}>
          <path d="M5.2 5.2 12 10.6 18.8 5.2V18.8L12 13.4 5.2 18.8Z" />
        </Frame>
      )
    case 'android-studio':
      return (
        <Frame size={size} strokeWidth={strokeWidth}>
          <path d="M5.8 16.2v-4a6.2 6.2 0 0 1 12.4 0v4z" />
          <path d="M8 5.2l1.6 2.6M16 5.2l-1.6 2.6" />
          <circle cx="9.6" cy="11.6" r="0.95" fill="currentColor" stroke="none" />
          <circle cx="14.4" cy="11.6" r="0.95" fill="currentColor" stroke="none" />
        </Frame>
      )
    default:
      return (
        <Frame size={size} strokeWidth={strokeWidth}>
          <Badge />
          <path d="M9.4 8.6 6.8 12l2.6 3.4M14.6 8.6 17.2 12l-2.6 3.4" />
        </Frame>
      )
  }
}





import type * as React from 'react'
import { h, useEffect, useRef, useState } from '../runtime.js'

export interface TooltipAnchorRect {
  left: number
  top: number
  bottom: number
}

interface Placement {
  text: string
  left: number
  top: number
  above: boolean
}

/** Close to the native delay, short enough to feel immediate. */
const DELAY_MS = 260
const MAX_WIDTH = 360
const EDGE = 8

export interface TooltipController {
  /** Show `text` under (or above) the anchor after a short hover delay. */
  show(text: string, rect: TooltipAnchorRect): void
  /** Show immediately, for keyboard focus. */
  showNow(text: string, rect: TooltipAnchorRect): void
  hide(): void
  /** Render this inside the panel; it positions itself against the viewport. */
  node: React.ReactElement | null
}

/**
 * A viewport-anchored tooltip drawn by the plugin instead of the browser's
 * `title` bubble, so the look and the delay stay the same on Windows, macOS,
 * and inside embedded webviews. It also survives scroll containers, because
 * the box is `position: fixed` and is removed on scroll or resize.
 */
export function useTooltip(): TooltipController {
  const [placement, setPlacement] = useState<Placement | null>(null)
  const timer = useRef<number | null>(null)

  const clearTimer = (): void => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }

  const place = (text: string, rect: TooltipAnchorRect): void => {
    const body = text.trim()
    if (body === '') {
      setPlacement(null)
      return
    }
    const width = Math.min(MAX_WIDTH, window.innerWidth - EDGE * 2)
    const left = Math.max(EDGE, Math.min(rect.left, window.innerWidth - width - EDGE))
    const above = rect.bottom + 64 > window.innerHeight
    setPlacement({ text: body, left, top: above ? rect.top - 6 : rect.bottom + 6, above })
  }

  const showNow = (text: string, rect: TooltipAnchorRect): void => {
    clearTimer()
    place(text, rect)
  }

  const show = (text: string, rect: TooltipAnchorRect): void => {
    clearTimer()
    setPlacement(null)
    timer.current = window.setTimeout(() => {
      timer.current = null
      place(text, rect)
    }, DELAY_MS)
  }

  const hide = (): void => {
    clearTimer()
    setPlacement(null)
  }

  useEffect(() => {
    if (placement === null) return undefined
    const dismiss = (): void => setPlacement(null)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [placement])

  useEffect(() => () => clearTimer(), [])

  const node = placement === null
    ? null
    : (
        <div
          className="dsh-gitlog-tooltip"
          role="tooltip"
          style={{
            left: placement.left,
            top: placement.top,
            maxWidth: `${MAX_WIDTH}px`,
            transform: placement.above ? 'translateY(-100%)' : undefined,
          }}
        >
          {placement.text}
        </div>
      )

  return { show, showNow, hide, node }
}

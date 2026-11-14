import type * as React from 'react'
import { h, useEffect, useState } from '../runtime.js'

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
/** Matches the fade-out keyframe so the bubble is removed after it ends. */
const FADE_OUT_MS = 110
const MAX_WIDTH = 360
const EDGE = 8

interface TooltipState {
  placement: Placement
  /** `out` keeps the bubble mounted while it fades away. */
  phase: 'in' | 'out'
}

type Listener = (state: TooltipState | null) => void

const listeners = new Set<Listener>()
let timer: number | null = null
let removal: number | null = null
let current: Placement | null = null

function emit(state: TooltipState | null): void {
  for (const listener of listeners) listener(state)
}

function clearTimer(): void {
  if (timer !== null) {
    window.clearTimeout(timer)
    timer = null
  }
}

function cancelRemoval(): void {
  if (removal !== null) {
    window.clearTimeout(removal)
    removal = null
  }
}

function render(placement: Placement): void {
  current = placement
  cancelRemoval()
  emit({ placement, phase: 'in' })
}

function place(text: string, rect: TooltipAnchorRect): void {
  const body = text.trim()
  if (body === '') {
    hideTooltip()
    return
  }
  const width = Math.min(MAX_WIDTH, window.innerWidth - EDGE * 2)
  const left = Math.max(EDGE, Math.min(rect.left, window.innerWidth - width - EDGE))
  const above = rect.bottom + 64 > window.innerHeight
  render({ text: body, left, top: above ? rect.top - 6 : rect.bottom + 6, above })
}

/** Show `text` near the anchor after the shared hover delay. */
export function showTooltip(text: string, rect: TooltipAnchorRect): void {
  clearTimer()
  if (current !== null) emit({ placement: current, phase: 'out' })
  timer = window.setTimeout(() => {
    timer = null
    place(text, rect)
  }, DELAY_MS)
}

/** Show immediately, for keyboard focus. */
export function showTooltipNow(text: string, rect: TooltipAnchorRect): void {
  clearTimer()
  place(text, rect)
}

/** Fade the bubble out, then unmount it once the animation has finished. */
export function hideTooltip(): void {
  clearTimer()
  if (current === null) {
    cancelRemoval()
    emit(null)
    return
  }
  cancelRemoval()
  emit({ placement: current, phase: 'out' })
  removal = window.setTimeout(() => {
    removal = null
    current = null
    emit(null)
  }, FADE_OUT_MS)
}

/**
 * Hover/focus handlers that show the panel's own tooltip instead of the
 * browser's `title` bubble, so the look and the delay match everywhere.
 */
export interface TooltipTargetProps {
  onMouseEnter(event: React.MouseEvent<HTMLElement>): void
  onMouseLeave(): void
  onFocus(event: React.FocusEvent<HTMLElement>): void
  onBlur(): void
}

/** `{...tooltipProps(t('label'))}` replaces a native `title` attribute. */
export function tooltipProps(text: string | (() => string)): TooltipTargetProps {
  const value = (): string => (typeof text === 'function' ? text() : text)
  return {
    onMouseEnter(event) {
      const body = value()
      if (body.trim() !== '') showTooltip(body, event.currentTarget.getBoundingClientRect())
    },
    onMouseLeave() {
      hideTooltip()
    },
    onFocus(event) {
      if (!event.currentTarget.matches(':focus-visible')) return
      const body = value()
      if (body.trim() !== '') showTooltipNow(body, event.currentTarget.getBoundingClientRect())
    },
    onBlur() {
      hideTooltip()
    },
  }
}

/**
 * Mount once per panel. It draws the single active tooltip, positioned against
 * the viewport, and dismisses itself on scroll or resize.
 */
export function TooltipHost(): React.ReactElement | null {
  const [state, setState] = useState<TooltipState | null>(null)

  useEffect(() => {
    listeners.add(setState)
    return () => {
      listeners.delete(setState)
      if (listeners.size === 0) {
        clearTimer()
        cancelRemoval()
      }
    }
  }, [])

  useEffect(() => {
    if (state === null) return undefined
    const dismiss = (): void => {
      clearTimer()
      hideTooltip()
    }
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [state])

  if (state === null) return null
  const { placement, phase } = state
  return (
    <div
      className={`dsh-gitlog-tooltip${phase === 'out' ? ' is-hiding' : ''}`}
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
}

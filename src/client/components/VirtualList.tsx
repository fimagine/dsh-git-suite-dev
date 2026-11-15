import type * as React from 'react'
import { h, useEffect, useRef, useState } from '../runtime.js'

export interface VirtualListProps<T> {
  /** Rows in display order. */
  items: readonly T[]
  /** Fixed row height; the window math depends on it. */
  rowHeight: number
  /** Extra rows rendered above and below the viewport. */
  overscan?: number
  renderRow(item: T, index: number): React.ReactNode
  /** Rendered when there are no rows. */
  empty?: React.ReactNode
  /** Rendered after the rows (loading indicator, load-more button, …). */
  footer?: React.ReactNode
  /** Called when the viewport is near the end (and when a short list is not full). */
  onReachEnd?(): void
  /** Reports the measured scroll viewport; useful for width-based layouts. */
  onViewportChange?(width: number, height: number): void
  /** Changing this value scrolls back to the top. */
  resetKey?: string | number
  className?: string
  role?: string
  ariaLabel?: string
}

const DEFAULT_OVERSCAN = 6
const REACH_END_ROWS = 4

/**
 * Fixed-height windowed list. It owns the scroll container and only renders the
 * visible slice plus `overscan` rows, with spacers preserving the scrollbar.
 */
export function VirtualList<T>({
  items,
  rowHeight,
  overscan = DEFAULT_OVERSCAN,
  renderRow,
  empty,
  footer,
  onReachEnd,
  onViewportChange,
  resetKey,
  className,
  role,
  ariaLabel,
}: VirtualListProps<T>): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const reachEnd = useRef(onReachEnd)
  reachEnd.current = onReachEnd
  const reportViewport = useRef(onViewportChange)
  reportViewport.current = onViewportChange

  useEffect(() => {
    const element = containerRef.current
    if (element === null) return undefined
    const measure = (): void => {
      setViewportHeight(element.clientHeight)
      reportViewport.current?.(element.clientWidth, element.clientHeight)
    }
    measure()
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(measure)
      observer.observe(element)
      return () => observer.disconnect()
    }
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    const element = containerRef.current
    if (element !== null) element.scrollTop = 0
    setScrollTop(0)
  }, [resetKey])

  // Pull the next page while the list does not fill the viewport yet.
  useEffect(() => {
    const element = containerRef.current
    if (element === null || items.length === 0) return
    if (viewportHeight > 0 && element.scrollHeight <= element.clientHeight + rowHeight) {
      reachEnd.current?.()
    }
  }, [items.length, rowHeight, viewportHeight])

  const total = items.length
  const start = Math.min(total, Math.max(0, Math.floor(scrollTop / rowHeight) - overscan))
  const end = Math.min(
    total,
    Math.ceil((scrollTop + Math.max(viewportHeight, rowHeight)) / rowHeight) + overscan,
  )

  return (
    <div
      ref={containerRef}
      className={className}
      role={role}
      aria-label={ariaLabel}
      onScroll={event => {
        const element = event.currentTarget
        setScrollTop(element.scrollTop)
        if (element.scrollHeight - element.scrollTop - element.clientHeight < rowHeight * REACH_END_ROWS) {
          reachEnd.current?.()
        }
      }}
    >
      {total === 0 ? empty : null}
      {start > 0 ? <div style={{ height: start * rowHeight }} aria-hidden={true} /> : null}
      {items.slice(start, end).map((item, index) => renderRow(item, start + index))}
      {end < total ? <div style={{ height: (total - end) * rowHeight }} aria-hidden={true} /> : null}
      {footer}
    </div>
  )
}

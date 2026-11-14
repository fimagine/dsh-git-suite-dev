import { useEffect, useRef, useState } from '../runtime.js'

export interface SplitSizeOptions {
  /** Size before any drag (and the value `reset()` returns to); lazy is fine. */
  initial: number | (() => number)
  /** Lower bound; a function is evaluated when a drag starts. */
  min: number | (() => number)
  /** Upper bound; a function is evaluated when a drag starts (containers move). */
  max: number | (() => number)
  /** `x` resizes width, `y` resizes height. */
  axis: 'x' | 'y'
  /** Dragging toward the left/top grows the size (far-side anchored panes). */
  invert?: boolean
  /**
   * Ratio mode: pixel deltas are divided by this measured length, so the size
   * stays a fraction (0..1). Used by the split panes inside the detail view.
   */
  reference?: () => number
  /**
   * Read the current size from the DOM at drag start. Content-sized panes use
   * this so the first drag continues from where the pane actually is.
   */
  measure?: () => number
  /** Called with the settled size; dragging writes at most one value per 140ms. */
  persist?: (size: number) => void
}

export interface SplitSize {
  size: number
  /** Whether a drag or reset has already produced a value. */
  touched: boolean
  start(): void
  drag(deltaX: number, deltaY: number): void
  reset(): void
  /** Adopt an externally stored value (e.g. the bucket of a newly opened repository). */
  apply(size: number): void
}

const PERSIST_DELAY_MS = 140

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function resolve(bound: number | (() => number)): number {
  return typeof bound === 'function' ? bound() : bound
}

/** A bound that is NaN (container not measured yet) falls back to the other side. */
function safe(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

/**
 * Owns one resizable size: the drag start value, the bounds, optional ratio
 * conversion, and debounced persistence. Combined with `Splitter` it covers
 * every drag handle in the panel.
 */
export function useSplitSize(options: SplitSizeOptions): SplitSize {
  const { initial, min, max, axis, invert = false, reference, measure, persist } = options
  // `initial` may read localStorage; only the first value matters.
  const initialRef = useRef<number | null>(null)
  if (initialRef.current === null) initialRef.current = resolve(initial)
  const initialSize = initialRef.current
  const [state, setState] = useState(() => {
    const low = safe(resolve(min), Number.NEGATIVE_INFINITY)
    const high = safe(resolve(max), Number.POSITIVE_INFINITY)
    return { size: clamp(initialSize, low, high), touched: false }
  })
  const startSize = useRef(initialSize)
  const bounds = useRef({ min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY })
  const length = useRef(0)
  const persistRef = useRef(persist)
  persistRef.current = persist

  useEffect(() => {
    if (persistRef.current === undefined) return undefined
    const timer = window.setTimeout(() => persistRef.current?.(state.size), PERSIST_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [state.size])

  return {
    size: state.size,
    touched: state.touched,
    start(): void {
      const measured = measure === undefined ? 0 : measure()
      startSize.current = measured > 0 ? measured : state.size
      bounds.current = {
        min: safe(resolve(min), Number.NEGATIVE_INFINITY),
        max: safe(resolve(max), Number.POSITIVE_INFINITY),
      }
      length.current = reference === undefined ? 0 : reference()
    },
    drag(deltaX: number, deltaY: number): void {
      let delta = axis === 'x' ? deltaX : deltaY
      if (reference !== undefined) {
        if (length.current <= 0) return
        delta /= length.current
      }
      if (invert) delta = -delta
      const low = bounds.current.min
      const high = Math.max(bounds.current.max, low)
      setState({ size: clamp(startSize.current + delta, low, high), touched: true })
    },
    reset(): void {
      setState({ size: clamp(initialSize, safe(resolve(min), initialSize), safe(resolve(max), initialSize)), touched: true })
    },
    apply(size: number): void {
      if (!Number.isFinite(size)) return
      const low = safe(resolve(min), Number.NEGATIVE_INFINITY)
      const high = safe(resolve(max), Number.POSITIVE_INFINITY)
      setState({ size: clamp(size, low, high), touched: true })
    },
  }
}


import type * as React from 'react'
import { h, useEffect, useRef, useState } from '../runtime.js'

const DURATION_MS = 3600

export interface ToastController {
  /** Show a transient message at the bottom of the panel. */
  show(text: string): void
  node: React.ReactElement | null
}

/** One short-lived message; a new message replaces the previous one. */
export function useToast(): ToastController {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  const clear = (): void => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }

  const show = (text: string): void => {
    if (text.trim() === '') return
    clear()
    setMessage(text)
    timer.current = window.setTimeout(() => {
      timer.current = null
      setMessage(null)
    }, DURATION_MS)
  }

  useEffect(() => () => clear(), [])

  const node = message === null
    ? null
    : <div className="dsh-gitlog-toast" role="status">{message}</div>

  return { show, node }
}

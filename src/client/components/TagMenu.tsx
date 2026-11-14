import type * as React from 'react'
import { h, useEffect, useRef } from '../runtime.js'
import type { Selection, Translate } from '../types.js'

export type TagSelection = Extract<Selection, { kind: 'tag' }>

export interface TagMenuState {
  tag: TagSelection
  x: number
  y: number
}

export interface TagMenuProps {
  context: TagMenuState | null
  t: Translate
  onCheckout(tag: TagSelection): void
  onEdit(tag: TagSelection): void
  onDelete(tag: TagSelection): void
  onClose(): void
}

/** Right-click menu for one tag: check out, edit, delete. */
export function TagMenu({ context, t, onCheckout, onEdit, onDelete, onClose }: TagMenuProps): React.ReactElement | null {
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (context === null) return undefined
    const onPointerDown = (event: MouseEvent): void => {
      if (menuRef.current !== null && !menuRef.current.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [context, onClose])

  if (context === null) return null
  const left = Math.min(context.x, window.innerWidth - 220)
  const top = Math.min(context.y, window.innerHeight - 120)

  return (
    <div
      ref={menuRef}
      className="dsh-gitlog-commit-menu"
      style={{ left, top }}
      role="menu"
      aria-label={t('tagMenu')}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onCheckout(context.tag)
          onClose()
        }}
      >
        {t('tagCheckoutMenu').replace('{tag}', context.tag.name)}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onEdit(context.tag)
          onClose()
        }}
      >
        {t('tagEditMenu').replace('{tag}', context.tag.name)}
      </button>
      <button
        type="button"
        role="menuitem"
        className="danger"
        onClick={() => {
          onDelete(context.tag)
          onClose()
        }}
      >
        {t('tagDeleteMenu').replace('{tag}', context.tag.name)}
      </button>
    </div>
  )
}

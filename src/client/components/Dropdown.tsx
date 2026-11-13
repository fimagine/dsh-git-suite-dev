import type * as React from 'react'
import { h, useEffect, useRef, useState } from '../runtime.js'

export interface DropdownOption {
  value: string
  label: string
  title?: string
  /** Optional group heading, rendered before the first option of that group. */
  group?: string
}

export interface DropdownProps {
  value: string
  options: DropdownOption[]
  onChange(value: string): void
  disabled?: boolean
  ariaLabel: string
  className?: string
  autoFocus?: boolean
  placeholder?: string
}

interface OptionGroup {
  name?: string
  options: DropdownOption[]
}

function groupOptions(options: DropdownOption[]): OptionGroup[] {
  const groups: OptionGroup[] = []
  for (const option of options) {
    const last = groups[groups.length - 1]
    if (last !== undefined && last.name === option.group) last.options.push(option)
    else groups.push({ name: option.group, options: [option] })
  }
  return groups
}

/** A custom listbox: the native select is replaced so the popup follows the DSH theme. */
export function Dropdown({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
  className,
  autoFocus = false,
  placeholder = '',
}: DropdownProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const selected = options.find(option => option.value === value)
  const selectedLabel = selected?.label ?? placeholder
  const groups = groupOptions(options)

  useEffect(() => {
    if (autoFocus) buttonRef.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event: MouseEvent): void => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const openMenu = (): void => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect !== undefined) {
      const width = Math.max(rect.width, 200)
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top: rect.bottom + 4,
        width: rect.width,
      })
    }
    const index = options.findIndex(option => option.value === value)
    setActive(index < 0 ? 0 : index)
    setOpen(true)
  }

  const select = (option: DropdownOption): void => {
    onChange(option.value)
    setOpen(false)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        openMenu()
      }
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive(index => (index + 1) % options.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(index => (index - 1 + options.length) % options.length)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActive(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActive(options.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const option = options[active]
      if (option !== undefined) select(option)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div
      ref={rootRef}
      className={`dsh-gitlog-dropdown${className === undefined ? '' : ` ${className}`}`}
    >
      <button
        ref={buttonRef}
        type="button"
        className="dsh-gitlog-dropdown-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        title={selected?.title ?? selected?.label ?? placeholder}
        onClick={() => {
          if (open) setOpen(false)
          else openMenu()
        }}
        onKeyDown={onKeyDown}
      >
        <span className="dsh-gitlog-dropdown-label">{selectedLabel}</span>
        <svg
          className="dsh-gitlog-dropdown-chevron"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden={true}
          focusable={false}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open
        ? (
            <div
              className="dsh-gitlog-dropdown-menu"
              role="listbox"
              aria-label={ariaLabel}
              style={position === null
                ? undefined
                : { left: position.left, top: position.top, minWidth: position.width }}
            >
              {groups.map(group => (
                <div key={group.name ?? '__default'} className="dsh-gitlog-dropdown-group">
                  {group.name === undefined
                    ? null
                    : <div className="dsh-gitlog-dropdown-group-label">{group.name}</div>}
                  {group.options.map(option => {
                    const index = options.indexOf(option)
                    return (
                      <button
                        key={option.value === '' ? '__manual' : option.value}
                        type="button"
                        role="option"
                        aria-selected={option.value === value}
                        className={`dsh-gitlog-dropdown-item${index === active ? ' is-active' : ''}${option.value === value ? ' is-selected' : ''}`}
                        title={option.title}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => select(option)}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )
        : null}
    </div>
  )
}

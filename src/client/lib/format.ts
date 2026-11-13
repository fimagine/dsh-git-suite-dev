import type { Translate } from '../types.js'

/** Locale-aware absolute date, falling back to the value itself when unparsable. */
export function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    return date.toLocaleString()
  }
}

const UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

/** Short relative time ("3 days ago") with a plain-text fallback when Intl is unavailable. */
export function relativeTime(value: string, t: Translate): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return t('justNow')

  let formatter: Intl.RelativeTimeFormat | null = null
  try {
    formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  } catch {
    formatter = null
  }

  for (const [unit, size] of UNITS) {
    if (abs >= size) {
      const amount = Math.round(seconds / size)
      return formatter === null
        ? `${Math.abs(amount)} ${unit}${Math.abs(amount) === 1 ? '' : 's'}`
        : formatter.format(amount, unit)
    }
  }
  return formatter === null ? `${abs} seconds` : formatter.format(seconds, 'second')
}

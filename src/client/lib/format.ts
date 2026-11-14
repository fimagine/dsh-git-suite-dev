/**
 * Absolute date and time down to the second, in the plugin's own UI language.
 * Chinese reads `2026-10-25 03:10:45`; other locales spell the month
 * (`Oct 25, 2026, 03:10:45`) so the column stays localized.
 */
export function formatDateTime(value: string, locale: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const chinese = locale.toLowerCase().startsWith('zh')
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: chinese ? '2-digit' : 'short',
      day: chinese ? '2-digit' : 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    const parts: Record<string, string> = {}
    for (const part of formatter.formatToParts(date)) {
      if (part.type !== 'literal') parts[part.type] = part.value
    }
    const time = `${parts.hour ?? '00'}:${parts.minute ?? '00'}:${parts.second ?? '00'}`
    return chinese
      ? `${parts.year ?? ''}-${parts.month ?? ''}-${parts.day ?? ''} ${time}`
      : `${parts.month ?? ''} ${parts.day ?? ''}, ${parts.year ?? ''}, ${time}`
  } catch {
    return date.toISOString().replace('T', ' ').slice(0, 19)
  }
}

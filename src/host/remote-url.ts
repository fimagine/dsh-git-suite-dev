import { isAbsolute } from 'node:path'

/**
 * Accept the remote transports Git can use without executing a local command.
 * `ext::` and similar transport helpers are refused.
 */
export function isSupportedRemote(value: string): boolean {
  if (value === '' || value.length > 2048) return false
  if (/^[a-z][a-z0-9+.-]*::/i.test(value)) return false
  if (/^(https?|ssh|git|file):\/\//i.test(value)) return true
  if (/^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+:[^\s]+$/.test(value)) return true
  return isAbsolute(value)
}

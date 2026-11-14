import type { Translate } from '../types.js'

/**
 * The OS file manager's localized name for the browser's platform. The plugin
 * cannot ask the host, and the label is the only place the difference shows.
 */
export function fileManagerName(t: Translate): string {
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent
  if (/Mac|iPhone|iPad/i.test(agent)) return t('finder')
  if (/Windows/i.test(agent)) return t('fileExplorer')
  return t('fileManager')
}

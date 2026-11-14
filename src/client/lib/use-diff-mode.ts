import { useState } from '../runtime.js'
import { readUiState, writeUiState } from './ui-state.js'
import type { DiffMode } from '../components/DiffView.js'

/** The diff layout preference, shared by the detail patch and the workspace diff. */
export function useDiffMode(): { mode: DiffMode; toggle(): void } {
  const [mode, setMode] = useState<DiffMode>(() => readUiState().diffMode ?? 'unified')
  return {
    mode,
    toggle(): void {
      setMode(current => {
        const next: DiffMode = current === 'unified' ? 'split' : 'unified'
        writeUiState({ diffMode: next })
        return next
      })
    },
  }
}

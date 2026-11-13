/**
 * Split combined `git show --patch` output into one block per changed file.
 *
 * `git show --numstat` and `git show --patch` walk the same diff in the same
 * order (both are driven by the same diffcore options), so a section's index
 * lines up with the changed-files entry at the same index. Sections are only
 * missing when the host truncated the patch output.
 */
export function splitPatch(patch: string): string[] {
  const sections: string[] = []
  let current: string[] | null = null

  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git ')) {
      if (current !== null) sections.push(current.join('\n'))
      current = []
    }
    if (current !== null) current.push(line)
  }
  if (current !== null) sections.push(current.join('\n'))

  return sections.filter(section => section.trim() !== '')
}

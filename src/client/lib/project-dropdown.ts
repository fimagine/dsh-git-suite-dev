import type { GitLogView } from '../hooks/useGitLogView.js'
import type { DropdownOption } from '../components/Dropdown.js'
import { projectLabel } from './projects.js'
import type { Translate } from '../types.js'

/** Options for the project dropdown, with the current repository and grouped projects. */
export function projectDropdownOptions(view: GitLogView, t: Translate): DropdownOption[] {
  const repo = view.repo
  const options: DropdownOption[] = []
  if (repo !== null) {
    options.push({
      value: repo.repoRoot,
      label: repo.superproject === null ? repo.repoName : `[submodule]${repo.repoName}`,
      title: repo.repoRoot,
    })
  }
  if (view.currentProject !== null && view.currentProject.path !== repo?.repoRoot) {
    options.push({
      value: view.currentProject.path,
      label: projectLabel(view.currentProject),
      title: view.currentProject.path,
    })
  }
  for (const project of view.projectGroups.recent) {
    if (project.path === repo?.repoRoot) continue
    options.push({
      value: project.path,
      label: projectLabel(project),
      title: project.path,
      group: t('recentProjects'),
    })
  }
  for (const project of view.projectGroups.workspace) {
    if (project.path === repo?.repoRoot) continue
    options.push({
      value: project.path,
      label: projectLabel(project),
      title: project.path,
      group: t('workspaceProjects'),
    })
  }
  return options
}

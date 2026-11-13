import type * as React from 'react'
import { h } from '../runtime.js'
import type { GitLogView } from '../hooks/useGitLogView.js'
import { projectLabel } from '../lib/projects.js'
import type { Project, Translate } from '../types.js'

const LIMITS = [25, 50, 100, 200, 0] as const

/** Project, path, branch, and page-size controls above the commit list. */
export function PanelControls({ view, t }: { view: GitLogView; t: Translate }): React.ReactElement {
  const projectOption = (project: Project): React.ReactElement => (
    <option key={project.path} value={project.path} title={project.path}>
      {projectLabel(project)}
    </option>
  )

  return (
    <form className="dsh-gitlog-controls" onSubmit={view.submitPath}>
      <label className="dsh-gitlog-field project">
        <span>{t('project')}</span>
        <select
          value={view.selectedProjectPath}
          onChange={view.selectProject}
          disabled={view.projectsStatus === 'loading'}
          title={view.selectedProjectPath || t('manualPath')}
        >
          <option value="">
            {view.projectsStatus === 'loading' ? t('scanningProjects') : t('manualPath')}
          </option>
          {view.currentProject ? projectOption(view.currentProject) : null}
          {view.projectGroups.recent.length > 0
            ? <optgroup label={t('recentProjects')}>{view.projectGroups.recent.map(projectOption)}</optgroup>
            : null}
          {view.projectGroups.workspace.length > 0
            ? <optgroup label={t('workspaceProjects')}>{view.projectGroups.workspace.map(projectOption)}</optgroup>
            : null}
        </select>
      </label>
      <button
        type="button"
        className="dsh-gitlog-btn"
        onClick={view.rescanProjects}
        disabled={view.projectsStatus === 'loading'}
      >
        {t('rescan')}
      </button>
      <label className="dsh-gitlog-field grow">
        <span>{t('path')}</span>
        <input
          type="text"
          value={view.pathInput}
          onChange={event => view.changePathText(event.target.value)}
          placeholder={t('pathPlaceholder')}
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      <label className="dsh-gitlog-field branch">
        <span>{t('branch')}</span>
        <select value={view.branchSelection} onChange={view.selectBranch} title={view.branchLabel}>
          <option value="HEAD">{view.currentBranchLabel}</option>
          <option value="__all__">{t('allBranches')}</option>
          <option value="__remotes__">{t('allRemoteBranches')}</option>
          {view.localBranches.length > 0
            ? (
                <optgroup label={t('localBranches')}>
                  {view.localBranches.map(branch => (
                    <option key={branch.ref} value={branch.ref} title={branch.ref}>{branch.name}</option>
                  ))}
                </optgroup>
              )
            : null}
          {view.remoteBranches.length > 0
            ? (
                <optgroup label={t('remoteBranches')}>
                  {view.remoteBranches.map(branch => (
                    <option key={branch.ref} value={branch.ref} title={branch.ref}>{branch.name}</option>
                  ))}
                </optgroup>
              )
            : null}
          {view.customBranch ? (
            <option value={view.customBranch.ref} title={view.customBranch.ref}>{view.customBranch.name}</option>
          ) : null}
        </select>
      </label>
      <label className="dsh-gitlog-field">
        <span>{t('limit')}</span>
        <select
          value={view.limit}
          onChange={event => view.setLimit(Number(event.target.value))}
        >
          {LIMITS.map(value => (
            <option key={value} value={value}>{value === 0 ? t('allCommits') : String(value)}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="dsh-gitlog-btn primary" disabled={view.status === 'loading'}>
        {t('load')}
      </button>
    </form>
  )
}

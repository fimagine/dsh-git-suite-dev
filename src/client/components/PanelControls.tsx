import type * as React from 'react'
import { h } from '../runtime.js'
import type { GitLogView } from '../hooks/useGitLogView.js'
import { projectDropdownOptions } from '../lib/project-dropdown.js'
import type { Translate } from '../types.js'
import { Dropdown } from './Dropdown.js'
import { RepositoryMenu } from './RepositoryMenu.js'

/** Project and path controls above the commit list; page size lives in Settings. */
export function PanelControls({ view, t }: { view: GitLogView; t: Translate }): React.ReactElement {
  return (
    <form className="dsh-gitlog-controls" onSubmit={view.submitPath}>
      <Dropdown
        className="dsh-gitlog-field project"
        value={view.selectedProjectPath}
        options={projectDropdownOptions(view, t)}
        onChange={view.selectProjectPath}
        disabled={view.projectsStatus === 'loading'}
        ariaLabel={t('project')}
        placeholder={t('selectProject')}
      />
      {view.repo !== null && view.repo.superproject !== null
        ? (
            <button
              type="button"
              className="dsh-gitlog-btn dsh-gitlog-parent-btn"
              title={t('backToParent')}
              onClick={() => view.openPath(view.repo?.superproject ?? '')}
            >
              {t('backToParent')}
            </button>
          )
        : null}
      <label className="dsh-gitlog-field grow">
        <input
          type="text"
          value={view.pathInput}
          onChange={event => view.changePathText(event.target.value)}
          placeholder={t('pathPlaceholder')}
          spellCheck={false}
          autoComplete="off"
          aria-label={t('path')}
        />
      </label>
      <RepositoryMenu view={view} t={t} />
    </form>
  )
}

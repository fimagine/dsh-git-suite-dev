import type { RequestParams } from './api.js'
import type { Repo, Selection, Translate } from '../types.js'

/** Query parameters that make `/git-suite?mode=log` read the selected refs. */
export function selectionParams(selection: Selection): Pick<RequestParams, 'scope' | 'ref'> {
  switch (selection.kind) {
    case 'all':
      return { scope: 'all' }
    case 'remotes':
      return { scope: 'remotes' }
    case 'branch':
    case 'tag':
      return { ref: selection.ref }
    case 'stash':
      return { scope: 'stash', ref: selection.hash }
    default:
      return {}
  }
}

/**
 * The scope to show after HEAD moves (branch switch, checkout, rename).
 * "All branches" is a user choice and stays put; other scopes follow HEAD.
 */
export function selectionAfterHeadChange(selection: Selection): Selection {
  return selection.kind === 'all' ? { kind: 'all' } : { kind: 'head' }
}

/** Stable identity used for tree highlighting. */
export function selectionKey(selection: Selection): string {
  switch (selection.kind) {
    case 'head':
      return 'head'
    case 'all':
      return 'all'
    case 'remotes':
      return 'remotes'
    case 'branch':
      return `branch:${selection.ref}`
    case 'tag':
      return `tag:${selection.ref}`
    case 'stash':
      return `stash:${selection.hash}`
  }
}

/** Text shown in the panel header and list head for the current selection. */
export function selectionLabel(selection: Selection, repo: Repo | null, t: Translate): string {
  switch (selection.kind) {
    case 'head':
      return repo && repo.branch && repo.branch !== 'detached'
        ? `${t('currentBranch')}: ${repo.branch}`
        : t('currentBranch')
    case 'all':
      return t('allBranches')
    case 'remotes':
      return t('allRemoteBranches')
    case 'branch':
    case 'tag':
      return selection.name
    case 'stash':
      return selection.ref
  }
}

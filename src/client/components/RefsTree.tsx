import type * as React from 'react'
import type { ApiError } from '../lib/api.js'
import { buildRefSections, filterTree, type TreeNode, type TreeSection } from '../lib/refs-tree.js'
import { selectionKey } from '../lib/selection.js'
import { readUiState, writeUiState } from '../lib/ui-state.js'
import { h, useEffect, useMemo, useRef, useState } from '../runtime.js'
import type { LoadStatus, RefsPayload, Selection, Translate } from '../types.js'
import { CompareIcon, PlusIcon } from './GitLogIcon.js'
import type { RemoteBranchSelection } from './RemoteBranchMenu.js'
import type { TagSelection } from './TagMenu.js'
import { useTooltip } from './Tooltip.js'
import { ChevronIcon, CurrentBranchIcon, SectionIcon } from './TreeIcons.js'
import type { TagStatusPayload } from '../types.js'

export interface RefsTreeProps {
  tree: RefsPayload | null
  status: LoadStatus
  error: ApiError | null
  selection: Selection
  switching: boolean
  onSelect(selection: Selection): void
  onSwitch(selection: Selection): void
  onOpenSubmodule?(path: string): void
  onAddBranch?(): void
  onAddRemote?(): void
  /** Compare local tags with the selected remote's tags. */
  onCompareTags?(): void
  tagStatus?: TagStatusPayload | null
  onRemoteMenu?(remote: string, event: React.MouseEvent): void
  onTagMenu?(selection: TagSelection, event: React.MouseEvent): void
  onRemoteBranchMenu?(selection: RemoteBranchSelection, event: React.MouseEvent): void
  onBranchMenu?(selection: Selection, event: React.MouseEvent): void
  t: Translate
}

const SECTION_DEFAULT_OPEN: Record<TreeSection['id'], boolean> = {
  branches: true,
  tags: false,
  remotes: false,
  stashes: false,
  submodules: true,
}

/** One indentation column: a guide line, an elbow, or blank space. */
type GuideState = 'is-line' | 'is-tee' | 'is-elbow' | 'is-blank'

interface SectionRow {
  key: string
  type: 'section'
  section: TreeSection
  open: boolean
}

interface NodeRow {
  key: string
  type: 'node'
  node: TreeNode
  depth: number
  last: boolean
  /** For each ancestor level: `true` when that ancestor still has siblings below. */
  ancestors: readonly boolean[]
  open: boolean
}

interface EmptyRow {
  key: string
  type: 'empty'
  depth: number
}

type TreeRow = SectionRow | NodeRow | EmptyRow

/** Branch/tag/remote/stash navigation for the left column of the panel. */
export function RefsTree({ tree, status, error, selection, switching, onSelect, onSwitch, onOpenSubmodule, onAddBranch, onAddRemote, onCompareTags, tagStatus, onRemoteMenu, onTagMenu, onRemoteBranchMenu, onBranchMenu, t }: RefsTreeProps): React.ReactElement {
  const [query, setQuery] = useState('')
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => ({
    ...SECTION_DEFAULT_OPEN,
    ...(readUiState().openSections ?? {}),
  }))
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>(() => ({
    ...(readUiState().collapsedFolders ?? {}),
  }))
  const tooltip = useTooltip()
  const searching = query.trim() !== ''

  useEffect(() => {
    writeUiState({ openSections })
  }, [openSections])

  useEffect(() => {
    writeUiState({ collapsedFolders })
  }, [collapsedFolders])
  const sections = useMemo(() => buildRefSections(tree, t), [tree, t])

  // Reveal a section when an item was added to it, even if it was collapsed.
  const remoteCount = tree?.remotes.length ?? 0
  const branchCount = tree?.branches.length ?? 0
  const lastCounts = useRef({ remotes: remoteCount, branches: branchCount })
  useEffect(() => {
    const previous = lastCounts.current
    if (remoteCount > previous.remotes) setOpenSections(current => ({ ...current, remotes: true }))
    if (branchCount > previous.branches) setOpenSections(current => ({ ...current, branches: true }))
    lastCounts.current = { remotes: remoteCount, branches: branchCount }
  }, [remoteCount, branchCount])

  // HEAD has no tree row of its own; highlight the checked-out branch instead.
  const selected = selection.kind === 'head' && tree !== null && tree.current !== 'detached'
    ? `branch:refs/heads/${tree.current}`
    : selectionKey(selection)

  const toggleSection = (id: string): void => {
    setOpenSections(current => ({ ...current, [id]: !current[id] }))
  }

  const toggleFolder = (key: string): void => {
    setCollapsedFolders(current => ({ ...current, [key]: !current[key] }))
  }

  /**
   * Show the row's extra information on hover or focus, and the label itself
   * only when the column is too narrow to show it in full.
   */
  const reveal = (event: React.SyntheticEvent<HTMLElement>, text: string, immediate = false): void => {
    const labelElement = event.currentTarget.querySelector<HTMLElement>('.dsh-gitlog-tree-label')
    const truncated = labelElement !== null && labelElement.scrollWidth > labelElement.clientWidth + 1
    const body = text !== '' ? text : truncated ? labelElement?.textContent ?? '' : ''
    if (body === '') {
      tooltip.hide()
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    if (immediate) tooltip.showNow(body, rect)
    else tooltip.show(body, rect)
  }

  const sectionTitle = (id: TreeSection['id']): string => {
    if (id === 'tags') return t('tags')
    if (id === 'remotes') return t('remotes')
    if (id === 'stashes') return t('stashes')
    if (id === 'submodules') return t('submodules')
    return t('branches')
  }

  const visible = useMemo(
    () => sections.map(section => ({ section, nodes: filterTree(section.nodes, query) })),
    [sections, query],
  )

  // Flatten the open sections into one list of rows so every row can draw the
  // same indentation guides; the sections themselves are the roots of the tree.
  const rows = useMemo(() => {
    const out: TreeRow[] = []

    const pushNodes = (nodes: readonly TreeNode[], depth: number, ancestors: readonly boolean[]): void => {
      nodes.forEach((node, index) => {
        const last = index === nodes.length - 1
        const open = searching || collapsedFolders[node.key] !== true
        out.push({ key: node.key, type: 'node', node, depth, last, ancestors, open })
        if (node.children !== undefined && open) {
          pushNodes(node.children, depth + 1, [...ancestors, !last])
        }
      })
    }

    for (const entry of visible) {
      if (searching && entry.nodes.length === 0) continue
      const open = searching || openSections[entry.section.id] === true
      out.push({ key: `section:${entry.section.id}`, type: 'section', section: entry.section, open })
      if (!open) continue
      if (entry.nodes.length === 0) {
        out.push({ key: `section:${entry.section.id}:empty`, type: 'empty', depth: 1 })
        continue
      }
      pushNodes(entry.nodes, 1, [])
    }

    return out
  }, [visible, searching, collapsedFolders, openSections])

  const anyVisible = visible.some(entry => entry.nodes.length > 0)

  const renderGuides = (depth: number, last: boolean, ancestors: readonly boolean[]): React.ReactNode[] => {
    const guides: React.ReactNode[] = []
    for (let level = 0; level < depth; level += 1) {
      let state: GuideState
      if (level === depth - 1) {
        state = last ? 'is-elbow' : 'is-tee'
      } else {
        state = ancestors[level] === true ? 'is-line' : 'is-blank'
      }
      guides.push(<span key={`guide-${level}`} className={`dsh-gitlog-tree-indent ${state}`} aria-hidden="true" />)
    }
    return guides
  }

  const renderSection = (row: SectionRow): React.ReactElement => {
    const addAction = row.section.id === 'remotes'
      ? onAddRemote
      : row.section.id === 'branches'
        ? onAddBranch
        : undefined
    const addLabel = row.section.id === 'remotes'
      ? t('addRemote')
      : row.section.id === 'branches' ? t('addBranch') : null
    return (
      <div key={row.key} className="dsh-gitlog-tree-section-row" role="none">
        <button
          type="button"
          role="treeitem"
          aria-level={1}
          aria-expanded={row.open}
          className="dsh-gitlog-tree-section-head"
          onClick={() => toggleSection(row.section.id)}
        >
          <span className="dsh-gitlog-tree-twist"><ChevronIcon open={row.open} /></span>
          <span className="dsh-gitlog-tree-glyph"><SectionIcon id={row.section.id} /></span>
          <span className="dsh-gitlog-tree-section-title">{sectionTitle(row.section.id)}</span>
        </button>
        {addAction !== undefined && addLabel !== null
          ? (
              <button
                type="button"
                className="dsh-gitlog-tree-action"
                aria-label={addLabel}
                onClick={() => addAction()}
                onMouseEnter={event => reveal(event, addLabel)}
                onMouseLeave={tooltip.hide}
                onFocus={event => {
                  if (event.currentTarget.matches(':focus-visible')) reveal(event, addLabel, true)
                }}
                onBlur={tooltip.hide}
              >
                <PlusIcon size={14} />
              </button>
            )
          : null}
        {row.section.id === 'tags' && onCompareTags !== undefined
          ? (
              <button
                type="button"
                className="dsh-gitlog-tree-action"
                aria-label={t('compareTags')}
                onClick={() => onCompareTags()}
                onMouseEnter={event => reveal(event, t('compareTags'))}
                onMouseLeave={tooltip.hide}
                onFocus={event => {
                  if (event.currentTarget.matches(':focus-visible')) reveal(event, t('compareTags'), true)
                }}
                onBlur={tooltip.hide}
              >
                <CompareIcon size={14} />
              </button>
            )
          : null}
      </div>
    )
  }

  const renderNode = (row: NodeRow): React.ReactElement => {
    const { node, depth, last, ancestors, open } = row
    const nodeSelection = node.selection
    const localBranch = nodeSelection !== undefined && nodeSelection.kind === 'branch' && !nodeSelection.remote
      ? nodeSelection
      : null
    const isSelected = nodeSelection !== undefined && selectionKey(nodeSelection) === selected
    const isGroup = node.children !== undefined
    const submodulePath = node.submodulePath
    const label = node.title ?? node.label
    // A remote group row also names the URL configured for it.
    const remoteUrl = node.kind === 'remote'
      ? tree?.remotes.find(group => group.name === node.label)?.url ?? ''
      : ''
    const counters = [
      node.ahead !== undefined && node.ahead > 0 ? `↑${node.ahead}` : '',
      node.behind !== undefined && node.behind > 0 ? `↓${node.behind}` : '',
      node.gone === true ? t('upstreamGone') : '',
    ].filter(part => part !== '').join(' ')
    const tagState = node.kind === 'tag' && tagStatus !== null && tagStatus !== undefined
      ? tagStatus.statuses[node.label]
      : undefined
    const tagBadge = tagState === 'local-only'
      ? t('tagLocalOnly')
      : tagState === 'different' ? t('tagDifferent') : ''
    const hint = submodulePath !== undefined
      ? node.title ?? node.label
      : remoteUrl !== ''
        ? `${label} — ${remoteUrl}`
        : localBranch === null
          ? tagBadge === '' ? '' : `${label} — ${tagBadge}`
          : `${label}${counters === '' ? '' : ` ${counters}`} — ${t('switchHint')}`
    return (
      <button
        key={row.key}
        type="button"
        role="treeitem"
        aria-level={depth + 1}
        aria-expanded={isGroup ? open : undefined}
        aria-selected={isGroup ? undefined : isSelected}
        aria-current={node.current === true ? 'true' : undefined}
        className={`dsh-gitlog-tree-row${isSelected ? ' is-selected' : ''}`}
        onMouseEnter={event => reveal(event, hint)}
        onMouseLeave={tooltip.hide}
        onFocus={event => {
          if (event.currentTarget.matches(':focus-visible')) reveal(event, hint, true)
        }}
        onBlur={tooltip.hide}
        onClick={() => {
          if (isGroup) {
            toggleFolder(node.key)
          } else if (submodulePath !== undefined) {
            onOpenSubmodule?.(submodulePath)
          } else if (nodeSelection !== undefined) {
            onSelect(nodeSelection)
          }
        }}
        onContextMenu={(node.kind === 'remote' && onRemoteMenu !== undefined)
          || (nodeSelection?.kind === 'branch' && !nodeSelection.remote && onBranchMenu !== undefined)
          || (nodeSelection?.kind === 'branch' && nodeSelection.remote && onRemoteBranchMenu !== undefined)
          || (nodeSelection?.kind === 'tag' && onTagMenu !== undefined)
          ? event => {
              event.preventDefault()
              if (node.kind === 'remote') onRemoteMenu?.(node.label, event)
              else if (nodeSelection?.kind === 'tag') onTagMenu?.(nodeSelection, event)
              else if (nodeSelection?.kind === 'branch' && nodeSelection.remote) onRemoteBranchMenu?.(nodeSelection, event)
              else if (nodeSelection !== undefined) onBranchMenu?.(nodeSelection, event)
            }
          : undefined}
        onDoubleClick={localBranch === null ? undefined : () => onSwitch(localBranch)}
      >
        {renderGuides(depth, last, ancestors)}
        <span className="dsh-gitlog-tree-twist">
          {isGroup ? <ChevronIcon open={open} /> : node.current === true ? <CurrentBranchIcon /> : null}
        </span>
        <span className={`dsh-gitlog-tree-label${node.current === true ? ' is-current' : ''}`}>{node.label}</span>
        {counters === '' ? null : <span className="dsh-gitlog-tree-counter">{counters}</span>}
        {tagBadge === '' ? null : (
          <span className={`dsh-gitlog-tree-counter${tagState === 'different' ? ' is-warn' : ''}`}>{tagBadge}</span>
        )}
      </button>
    )
  }

  const renderEmpty = (row: EmptyRow): React.ReactElement => (
    <p key={row.key} className="dsh-gitlog-tree-empty" style={{ paddingLeft: 22 + row.depth * 16 }}>
      {t('noTreeItems')}
    </p>
  )

  return (
    <aside className="dsh-gitlog-tree" aria-busy={switching}>
      <div className="dsh-gitlog-tree-header">
        <input
          className="dsh-gitlog-tree-input"
          type="text"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={t('search')}
          aria-label={t('search')}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
      <div className="dsh-gitlog-tree-scroll">
        {tree === null && status === 'loading' ? <p className="dsh-gitlog-tree-empty">{t('loadingRefs')}</p> : null}
        {tree === null && status === 'error'
          ? <p className="dsh-gitlog-tree-empty">{error?.message || t('treeFailed')}</p>
          : null}
        {tree !== null && searching && !anyVisible ? <p className="dsh-gitlog-tree-empty">{t('noTreeItems')}</p> : null}
        {tree !== null
          ? (
              <div className="dsh-gitlog-tree-list" role="tree" aria-label={t('branches')}>
                {rows.map(row => {
                  if (row.type === 'section') return renderSection(row)
                  if (row.type === 'node') return renderNode(row)
                  return renderEmpty(row)
                })}
              </div>
            )
          : null}
      </div>
      {tooltip.node}
    </aside>
  )
}

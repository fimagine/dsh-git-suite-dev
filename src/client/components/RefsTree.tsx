import type * as React from 'react'
import type { ApiError } from '../lib/api.js'
import { buildRefSections, filterTree, type TreeNode, type TreeSection } from '../lib/refs-tree.js'
import { selectionKey } from '../lib/selection.js'
import { h, useMemo, useState } from '../runtime.js'
import type { LoadStatus, RefsPayload, Selection, Translate } from '../types.js'
import { ChevronIcon, CurrentBranchIcon, SectionIcon } from './TreeIcons.js'

export interface RefsTreeProps {
  tree: RefsPayload | null
  status: LoadStatus
  error: ApiError | null
  selection: Selection
  switching: boolean
  onSelect(selection: Selection): void
  onSwitch(selection: Selection): void
  onOpenSubmodule?(path: string): void
  onRemoteMenu?(remote: string, event: React.MouseEvent): void
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
export function RefsTree({ tree, status, error, selection, switching, onSelect, onSwitch, onOpenSubmodule, onRemoteMenu, onBranchMenu, t }: RefsTreeProps): React.ReactElement {
  const [query, setQuery] = useState('')
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ ...SECTION_DEFAULT_OPEN })
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({})
  const searching = query.trim() !== ''
  const sections = useMemo(() => buildRefSections(tree, t), [tree, t])
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

  const renderSection = (row: SectionRow): React.ReactElement => (
    <button
      key={row.key}
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
  )

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
        title={submodulePath !== undefined
          ? node.title ?? node.label
          : localBranch === null ? label : `${label} — ${t('switchHint')}`}
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
          ? event => {
              event.preventDefault()
              if (node.kind === 'remote') onRemoteMenu?.(node.label, event)
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
    </aside>
  )
}

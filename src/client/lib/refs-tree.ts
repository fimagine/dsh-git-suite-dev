import type { Branch, RefsPayload, Selection, Translate } from '../types.js'

export type TreeNodeKind = 'branch' | 'folder' | 'tag' | 'stash' | 'remote' | 'scope' | 'submodule'

export interface TreeNode {
  key: string
  label: string
  kind: TreeNodeKind
  title?: string
  current?: boolean
  selection?: Selection
  /** Repository-relative path when this node opens a submodule repository. */
  submodulePath?: string
  children?: TreeNode[]
}

export interface TreeSection {
  id: 'branches' | 'tags' | 'remotes' | 'stashes' | 'submodules'
  nodes: TreeNode[]
}

/** Build the tree sections from one refs payload. */
export function buildRefSections(tree: RefsPayload | null, t: Translate): TreeSection[] {
  if (tree === null) {
    return [
      { id: 'branches', nodes: [] },
      { id: 'tags', nodes: [] },
      { id: 'remotes', nodes: [] },
      { id: 'stashes', nodes: [] },
    ]
  }

  const sections: TreeSection[] = [
    {
      id: 'branches',
      nodes: buildBranchNodes(tree.branches),
    },
  ]

  if (tree.tags.length > 0) {
    sections.push({
      id: 'tags',
      nodes: tree.tags.map((tag): TreeNode => ({
        key: `tag:${tag.ref}`,
        label: tag.name,
        kind: 'tag',
        title: tag.ref,
        selection: { kind: 'tag', ref: tag.ref, name: tag.name },
      })),
    })
  }

  sections.push({
    id: 'remotes',
    nodes: tree.remotes.map((group): TreeNode => ({
      key: `remote:${group.name}`,
      label: group.name,
      kind: 'remote',
      children: group.branches.map(branch => remoteBranchNode(branch, group.name)),
    })),
  })

  if (tree.stashes.length > 0) {
    sections.push({
      id: 'stashes',
      nodes: tree.stashes.map((stash): TreeNode => ({
        key: `stash:${stash.hash}`,
        label: stash.message || stash.ref,
        kind: 'stash',
        title: `${stash.ref} · ${stash.message}`,
        selection: { kind: 'stash', ref: stash.ref, hash: stash.hash },
      })),
    })
  }

  if (tree.submodules.length > 0) {
    sections.push({
      id: 'submodules',
      nodes: tree.submodules.map((submodule): TreeNode => ({
        key: `submodule:${submodule.path}`,
        label: submodule.name,
        kind: 'submodule',
        title: submodule.path,
        submodulePath: submodule.path,
      })),
    })
  }

  return sections
}

function remoteBranchNode(branch: Branch, remote: string): TreeNode {
  const prefix = `${remote}/`
  const label = branch.name.startsWith(prefix) ? branch.name.slice(prefix.length) : branch.name
  return {
    key: `branch:${branch.ref}`,
    label,
    kind: 'branch',
    title: branch.name,
    selection: { kind: 'branch', ref: branch.ref, name: branch.name, remote: true },
  }
}

/** Fold `feat/x` into a `feat` folder, matching the shape of a source-control branch tree. */
function buildBranchNodes(branches: readonly Branch[]): TreeNode[] {
  const roots: TreeNode[] = []

  for (const branch of branches) {
    const parts = branch.name.split('/')
    let level = roots
    let path = ''
    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index]
      if (part === undefined) continue
      path = path === '' ? part : `${path}/${part}`
      let folder = level.find(node => node.kind === 'folder' && node.label === part)
      if (folder === undefined) {
        folder = { key: `folder:${path}`, label: part, kind: 'folder', children: [] }
        level.push(folder)
      }
      level = folder.children ?? []
      folder.children = level
    }
    level.push({
      key: `branch:${branch.ref}`,
      label: parts[parts.length - 1] ?? branch.name,
      kind: 'branch',
      title: branch.name,
      current: branch.current,
      selection: { kind: 'branch', ref: branch.ref, name: branch.name, remote: false },
    })
  }

  sortNodes(roots)
  return roots
}

function sortNodes(nodes: TreeNode[]): void {
  nodes.sort((left, right) => {
    if (left.kind === 'folder' && right.kind !== 'folder') return -1
    if (right.kind === 'folder' && left.kind !== 'folder') return 1
    return left.label.localeCompare(right.label)
  })
  for (const node of nodes) {
    if (node.children !== undefined) sortNodes(node.children)
  }
}

/** Keep matching leaves and their ancestors; a matching folder keeps all of its children. */
export function filterTree(nodes: readonly TreeNode[], query: string): TreeNode[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return [...nodes]

  const keep = (node: TreeNode): TreeNode | null => {
    if (node.children !== undefined) {
      const children = node.children.map(keep).filter((child): child is TreeNode => child !== null)
      if (children.length > 0) return { ...node, children }
      return node.label.toLowerCase().includes(needle) ? { ...node, children: node.children } : null
    }
    const haystack = `${node.label}\n${node.title ?? ''}`.toLowerCase()
    return haystack.includes(needle) ? node : null
  }

  return nodes.map(keep).filter((node): node is TreeNode => node !== null)
}

import type { Commit } from '../types.js'

export interface GraphRow {
  commit: Commit
  /** Lane contents before this row. */
  before: Array<string | null>
  /** Lane contents after this row. */
  after: Array<string | null>
  nodeLane: number
  /** Lanes that were waiting for this commit and got absorbed by it. */
  merged: number[]
  /** Lane chosen for each parent commit. */
  parentLanes: number[]
}

export interface GraphLayout {
  rows: GraphRow[]
  maxLanes: number
}

export interface GraphGeometry {
  width: number
  nodeRadius: number
  mergeRadius: number
  x(index: number): number
}

const LANE_COLORS = [
  'var(--dsw-alias-brand-primary)',
  'var(--dsw-alias-state-success-primary)',
  'var(--dsw-alias-state-warn-primary)',
  'var(--dsw-alias-state-error-primary)',
  'var(--dsw-alias-state-idle-primary)',
  'var(--dsw-alias-label-secondary)',
]

export function laneColor(index: number): string {
  return LANE_COLORS[index % LANE_COLORS.length] ?? LANE_COLORS[0] ?? 'currentColor'
}

/**
 * Lay commits out on lanes. Each lane carries the hash expected at the next
 * row; a commit takes its own lane, absorbs every lane that also expected it,
 * and starts lanes for its parents. Keeping vacant slots avoids moving
 * unrelated lines sideways, which is what makes merges readable.
 */
export function layoutGraph(commits: readonly Commit[]): GraphLayout {
  const rows: GraphRow[] = []
  const lanes: Array<string | null> = []
  let maxLanes = 1

  for (const commit of commits) {
    let nodeLane = lanes.indexOf(commit.hash)
    if (nodeLane === -1) {
      nodeLane = lanes.indexOf(null)
      if (nodeLane === -1) {
        nodeLane = lanes.length
        lanes.push(null)
      }
    }

    const before = lanes.slice()
    const merged: number[] = []
    for (let index = 0; index < before.length; index += 1) {
      if (before[index] === commit.hash) merged.push(index)
    }
    for (const index of merged) lanes[index] = null

    const parentLanes: number[] = []
    for (let parentIndex = 0; parentIndex < commit.parents.length; parentIndex += 1) {
      const parent = commit.parents[parentIndex]
      if (parent === undefined) continue
      let lane = lanes.indexOf(parent)
      if (lane === -1) {
        if (parentIndex === 0) {
          lane = nodeLane
        } else {
          lane = lanes.indexOf(null)
          if (lane === -1) {
            lane = lanes.length
            lanes.push(null)
          }
        }
        lanes[lane] = parent
      }
      parentLanes.push(lane)
    }

    const after = lanes.slice()
    maxLanes = Math.max(maxLanes, before.length, after.length, nodeLane + 1)
    for (const lane of parentLanes) maxLanes = Math.max(maxLanes, lane + 1)
    rows.push({ commit, before, after, nodeLane, merged, parentLanes })

    while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop()
  }

  return { rows, maxLanes }
}

/**
 * Fixed lane spacing: the graph keeps its natural width and the graph column
 * clips the overflow when it is narrower. Nothing is scaled to fit.
 */
export function graphGeometry(maxLanes: number): GraphGeometry {
  const spacing = 16
  const width = maxLanes <= 1 ? 24 : 16 + spacing * (maxLanes - 1)
  return {
    width,
    nodeRadius: 4.5,
    mergeRadius: 6,
    x(index: number): number {
      return maxLanes <= 1 ? width / 2 : 8 + index * spacing
    },
  }
}

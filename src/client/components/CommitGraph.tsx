import type * as React from 'react'
import { h } from '../runtime.js'
import { laneColor, type GraphGeometry, type GraphRow } from '../lib/graph.js'

const LINE_PROPS = {
  fill: 'none',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  vectorEffect: 'non-scaling-stroke',
} as const

export interface CommitGraphProps {
  row: GraphRow
  geometry: GraphGeometry
  /** Height of one log row; the graph is drawn edge to edge so lanes connect. */
  height: number
}

/** The lane drawing for one row: incoming edges, pass-through lines, and outgoing parent edges. */
export function CommitGraph({ row, geometry, height }: CommitGraphProps): React.ReactElement {
  const { commit, before, after, nodeLane, parentLanes } = row
  const x = geometry.x
  const mid = height / 2
  const elements: React.ReactNode[] = []
  const laneCount = Math.max(before.length, after.length)

  for (let index = 0; index < laneCount; index += 1) {
    const previous = before[index]
    const next = after[index]
    if (previous === undefined || previous === null) continue
    if (previous === commit.hash) {
      if (index !== nodeLane) {
        elements.push(
          <path
            key={`incoming-${index}`}
            d={`M ${x(index)} 0 C ${x(index)} ${height * 0.29}, ${x(nodeLane)} ${height * 0.21}, ${x(nodeLane)} ${mid}`}
            stroke={laneColor(index)}
            {...LINE_PROPS}
          />,
        )
      }
    } else if (previous === next) {
      elements.push(
        <line
          key={`through-${index}`}
          x1={x(index)}
          y1={0}
          x2={x(index)}
          y2={height}
          stroke={laneColor(index)}
          {...LINE_PROPS}
        />,
      )
    }
  }

  if (before[nodeLane] === commit.hash) {
    elements.push(
      <line
        key="node-in"
        x1={x(nodeLane)}
        y1={0}
        x2={x(nodeLane)}
        y2={mid}
        stroke={laneColor(nodeLane)}
        {...LINE_PROPS}
      />,
    )
  }

  parentLanes.forEach((lane, parentIndex) => {
    if (lane === nodeLane) {
      elements.push(
        <line
          key={`outgoing-${parentIndex}`}
          x1={x(nodeLane)}
          y1={mid}
          x2={x(nodeLane)}
          y2={height}
          stroke={laneColor(lane)}
          {...LINE_PROPS}
        />,
      )
    } else {
      elements.push(
        <path
          key={`outgoing-${parentIndex}`}
          d={`M ${x(nodeLane)} ${mid} C ${x(nodeLane)} ${height * 0.71}, ${x(lane)} ${height * 0.79}, ${x(lane)} ${height}`}
          stroke={laneColor(lane)}
          {...LINE_PROPS}
        />,
      )
    }
  })

  const nodeColor = laneColor(nodeLane)
  if (commit.parents.length > 1) {
    elements.push(
      <circle
        key="node"
        cx={x(nodeLane)}
        cy={mid}
        r={geometry.mergeRadius}
        fill="var(--dsw-alias-bg-layer-1)"
        stroke={nodeColor}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />,
    )
    elements.push(
      <circle key="node-core" cx={x(nodeLane)} cy={mid} r={geometry.mergeRadius * 0.4} fill={nodeColor} />,
    )
  } else {
    elements.push(
      <circle
        key="node"
        cx={x(nodeLane)}
        cy={mid}
        r={geometry.nodeRadius}
        fill={nodeColor}
        stroke="var(--dsw-alias-bg-layer-1)"
        strokeWidth={2.5}
        vectorEffect="non-scaling-stroke"
      />,
    )
  }

  return (
    <svg
      width={geometry.width}
      height={height}
      viewBox={`0 0 ${geometry.width} ${height}`}
      aria-hidden={true}
      focusable={false}
    >
      {elements}
    </svg>
  )
}

import type * as React from 'react'
import { h } from '../runtime.js'
import { laneColor, type GraphGeometry, type GraphRow } from '../lib/graph.js'

const LINE_PROPS = {
  fill: 'none',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  vectorEffect: 'non-scaling-stroke',
} as const

/** The lane drawing for one row: incoming edges, pass-through lines, and outgoing parent edges. */
export function CommitGraph({ row, geometry }: { row: GraphRow; geometry: GraphGeometry }): React.ReactElement {
  const { commit, before, after, nodeLane, parentLanes } = row
  const x = geometry.x
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
            d={`M ${x(index)} 0 C ${x(index)} 14, ${x(nodeLane)} 10, ${x(nodeLane)} 24`}
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
          y2={48}
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
        y2={24}
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
          y1={24}
          x2={x(nodeLane)}
          y2={48}
          stroke={laneColor(lane)}
          {...LINE_PROPS}
        />,
      )
    } else {
      elements.push(
        <path
          key={`outgoing-${parentIndex}`}
          d={`M ${x(nodeLane)} 24 C ${x(nodeLane)} 34, ${x(lane)} 38, ${x(lane)} 48`}
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
        cy={24}
        r={geometry.mergeRadius}
        fill="var(--dsw-alias-bg-layer-1)"
        stroke={nodeColor}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />,
    )
    elements.push(
      <circle key="node-core" cx={x(nodeLane)} cy={24} r={geometry.mergeRadius * 0.4} fill={nodeColor} />,
    )
  } else {
    elements.push(
      <circle
        key="node"
        cx={x(nodeLane)}
        cy={24}
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
      height={48}
      viewBox={`0 0 ${geometry.width} 48`}
      aria-hidden={true}
      focusable={false}
    >
      {elements}
    </svg>
  )
}

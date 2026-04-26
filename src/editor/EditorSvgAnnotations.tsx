import type { ReactElement } from 'react'
import { PIXELS_PER_METER } from '../constants'
import { normalizeSupportType, type RuntimeSupportType } from '../lib/truss-model'
import type {
  Member,
  MemberAnalysisResult,
  Node2D,
  NodeDisplacement,
  NodeReaction,
} from '../types'

export function SupportSymbol({ node }: { node: Node2D }) {
  const support = normalizeSupportType(node.support as RuntimeSupportType | undefined)

  if (!support) {
    return null
  }

  const baseY = node.y + 20
  const rollerXSymbol = (
    <>
      <line x1={node.x} y1={node.y + 8} x2={node.x} y2={baseY - 2} className="support-link" />
      <polygon
        points={`${node.x},${baseY - 2} ${node.x - 12},${baseY + 10} ${node.x + 12},${baseY + 10}`}
        className="support-shape"
      />
      <circle cx={node.x - 7} cy={baseY + 16} r={4} className="support-wheel" />
      <circle cx={node.x + 7} cy={baseY + 16} r={4} className="support-wheel" />
      <line
        x1={node.x - 16}
        y1={baseY + 22}
        x2={node.x + 16}
        y2={baseY + 22}
        className="support-base"
      />
    </>
  )

  if (support === 'pinned') {
    return (
      <g className="support-symbol" pointerEvents="none">
        <line x1={node.x} y1={node.y + 8} x2={node.x} y2={baseY - 2} className="support-link" />
        <polygon
          points={`${node.x},${baseY - 2} ${node.x - 12},${baseY + 14} ${node.x + 12},${baseY + 14}`}
          className="support-shape"
        />
      </g>
    )
  }

  if (support === 'roller-x') {
    return (
      <g className="support-symbol" pointerEvents="none">
        {rollerXSymbol}
      </g>
    )
  }

  return (
    <g
      className="support-symbol"
      pointerEvents="none"
      transform={`rotate(90 ${node.x + 3} ${node.y + 4})`}
    >
      {rollerXSymbol}
    </g>
  )
}

export function NodeLoads({ node }: { node: Node2D }) {
  const loadElements: ReactElement[] = []

  if (node.horizontalLoad) {
    const arrowLength = clampArrowLength(node.horizontalLoad.magnitudeKn)
    const direction = node.horizontalLoad.direction === 'left' ? -1 : 1
    const endX = node.x + direction * arrowLength
    const offsetY = node.verticalLoad ? node.y - 34 : node.y - 26

    loadElements.push(
      <g key="horizontal-load" className="node-load" pointerEvents="none">
        <line x1={node.x} y1={offsetY} x2={endX} y2={offsetY} className="load-arrow-line" />
        <polygon
          points={
            direction === 1
              ? `${endX},${offsetY} ${endX - 10},${offsetY - 5} ${endX - 10},${offsetY + 5}`
              : `${endX},${offsetY} ${endX + 10},${offsetY - 5} ${endX + 10},${offsetY + 5}`
          }
          className="load-arrow-head"
        />
        <text
          x={(node.x + endX) / 2}
          y={offsetY - 8}
          className="load-label-text"
          textAnchor="middle"
        >
          {node.horizontalLoad.magnitudeKn.toFixed(1)} kN
        </text>
      </g>,
    )
  }

  if (node.verticalLoad) {
    const arrowLength = clampArrowLength(node.verticalLoad.magnitudeKn)
    const direction = node.verticalLoad.direction === 'up' ? -1 : 1
    const endY = node.y + direction * arrowLength
    const offsetX = node.horizontalLoad ? node.x + 34 : node.x + 26

    loadElements.push(
      <g key="vertical-load" className="node-load" pointerEvents="none">
        <line x1={offsetX} y1={node.y} x2={offsetX} y2={endY} className="load-arrow-line" />
        <polygon
          points={
            direction === 1
              ? `${offsetX},${endY} ${offsetX - 5},${endY - 10} ${offsetX + 5},${endY - 10}`
              : `${offsetX},${endY} ${offsetX - 5},${endY + 10} ${offsetX + 5},${endY + 10}`
          }
          className="load-arrow-head"
        />
        <text x={offsetX + 10} y={(node.y + endY) / 2 - 6} className="load-label-text">
          {node.verticalLoad.magnitudeKn.toFixed(1)} kN
        </text>
      </g>,
    )
  }

  return <>{loadElements}</>
}

export function DisplacedShapeOverlay({
  nodes,
  members,
  displacementByNodeId,
  displayScale,
}: {
  nodes: Node2D[]
  members: Member[]
  displacementByNodeId: Map<string, NodeDisplacement>
  displayScale: number
}) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  return (
    <g pointerEvents="none">
      {members.map((member) => {
        const startNode = nodeById.get(member.nodeAId)
        const endNode = nodeById.get(member.nodeBId)

        if (!startNode || !endNode) {
          return null
        }

        const displacedStart = getDisplacedNodePosition(
          startNode,
          displacementByNodeId.get(startNode.id),
          displayScale,
        )
        const displacedEnd = getDisplacedNodePosition(
          endNode,
          displacementByNodeId.get(endNode.id),
          displayScale,
        )

        return (
          <line
            key={member.id}
            x1={displacedStart.x}
            y1={displacedStart.y}
            x2={displacedEnd.x}
            y2={displacedEnd.y}
            className="displaced-member-line"
          />
        )
      })}
    </g>
  )
}

export function MemberForceLabel({
  midX,
  midY,
  result,
}: {
  midX: number
  midY: number
  result: MemberAnalysisResult | undefined
}) {
  if (!result) {
    return null
  }

  return (
    <text
      x={midX}
      y={midY + 16}
      className={`member-force-label member-force-label-${result.state}`}
      textAnchor="middle"
    >
      {formatSignedKn(result.axialForceKn)}
    </text>
  )
}

export function ReactionOverlay({
  node,
  reaction,
}: {
  node: Node2D
  reaction: NodeReaction | undefined
}) {
  if (!reaction) {
    return null
  }

  return (
    <>
      {Math.abs(reaction.xKn) > 1e-6 ? (
        <DirectionalResultArrow
          startX={node.x}
          startY={node.y - 18}
          dx={
            reaction.xKn > 0
              ? clampArrowLength(Math.abs(reaction.xKn))
              : -clampArrowLength(Math.abs(reaction.xKn))
          }
          dy={0}
          label={formatSignedKn(reaction.xKn)}
          labelDx={0}
          labelDy={-8}
        />
      ) : null}
      {Math.abs(reaction.zKn) > 1e-6 ? (
        <DirectionalResultArrow
          startX={node.x + 18}
          startY={node.y}
          dx={0}
          dy={
            reaction.zKn > 0
              ? -clampArrowLength(Math.abs(reaction.zKn))
              : clampArrowLength(Math.abs(reaction.zKn))
          }
          label={formatSignedKn(reaction.zKn)}
          labelDx={10}
          labelDy={-4}
        />
      ) : null}
    </>
  )
}

function DirectionalResultArrow({
  startX,
  startY,
  dx,
  dy,
  label,
  labelDx,
  labelDy,
}: {
  startX: number
  startY: number
  dx: number
  dy: number
  label: string
  labelDx: number
  labelDy: number
}) {
  const endX = startX + dx
  const endY = startY + dy

  return (
    <g className="reaction-overlay" pointerEvents="none">
      <line x1={startX} y1={startY} x2={endX} y2={endY} className="reaction-arrow-line" />
      <polygon points={getArrowHeadPoints(endX, endY, dx, dy)} className="reaction-arrow-head" />
      <text
        x={(startX + endX) / 2 + labelDx}
        y={(startY + endY) / 2 + labelDy}
        className="reaction-label-text"
      >
        {label}
      </text>
    </g>
  )
}

function clampArrowLength(magnitudeKn: number) {
  return Math.min(72, Math.max(28, 20 + magnitudeKn * 4))
}

function getDisplacedNodePosition(
  node: Node2D,
  displacement: NodeDisplacement | undefined,
  displayScale: number,
) {
  return {
    x: node.x + (displacement?.xMeters ?? 0) * PIXELS_PER_METER * displayScale,
    y: node.y - (displacement?.zMeters ?? 0) * PIXELS_PER_METER * displayScale,
  }
}

function getArrowHeadPoints(endX: number, endY: number, dx: number, dy: number) {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0
      ? `${endX},${endY} ${endX - 10},${endY - 5} ${endX - 10},${endY + 5}`
      : `${endX},${endY} ${endX + 10},${endY - 5} ${endX + 10},${endY + 5}`
  }

  return dy >= 0
    ? `${endX},${endY} ${endX - 5},${endY - 10} ${endX + 5},${endY - 10}`
    : `${endX},${endY} ${endX - 5},${endY + 10} ${endX + 5},${endY + 10}`
}

function formatSignedKn(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)} kN`
}

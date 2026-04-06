import { useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { MouseEvent } from 'react'
import {
  EDITOR_HEIGHT,
  EDITOR_WIDTH,
  PIXELS_PER_METER,
  pixelsToMeters,
  snapToGrid,
} from '../constants'
import { normalizeSupportType, type RuntimeSupportType } from '../lib/truss-model'
import type {
  HorizontalLoadDirection,
  Member,
  MemberAnalysisResult,
  Node2D,
  NodeDisplacement,
  NodeReaction,
  SupportType,
  TrussAnalysisResult,
  VerticalLoadDirection,
} from '../types'
import type { EditorTool, SelectedEntity } from '../App'

type Editor2DProps = {
  nodes: Node2D[]
  members: Member[]
  analysis: TrussAnalysisResult
  displacementDisplayScale: number
  activeTool: EditorTool
  memberStartNodeId: string | null
  selectedEntity: SelectedEntity
  onCanvasClick: (x: number, y: number) => void
  onNodeClick: (nodeId: string) => void
  onMemberClick: (memberId: string) => void
  onMoveNode: (nodeId: string, x: number, y: number) => void
  onSetActiveTool: (tool: EditorTool) => void
  onSetSelectedNodeSupport: (support: SupportType | undefined) => void
  onSetSelectedMemberAxialStiffness: (axialStiffnessKn: number) => void
  onSetSelectedNodeHorizontalLoad: (
    magnitudeKn: number,
    direction: HorizontalLoadDirection,
  ) => void
  onSetSelectedNodeVerticalLoad: (
    magnitudeKn: number,
    direction: VerticalLoadDirection,
  ) => void
  onDeleteNode: (nodeId: string) => void
  onDeleteMember: (memberId: string) => void
}

const NODE_RADIUS = 8
const AXIS_MARGIN = 28
const TOOL_OPTIONS: { value: EditorTool; label: string }[] = [
  { value: 'select', label: 'Select' },
  { value: 'node', label: 'Node' },
  { value: 'member', label: 'Member' },
]
const SUPPORT_OPTIONS: { value: SupportType | undefined; label: string }[] = [
  { value: undefined, label: 'None' },
  { value: 'pinned', label: 'Pinned' },
  { value: 'roller-x', label: 'Roller X' },
  { value: 'roller-z', label: 'Roller Z' },
]

export function Editor2D({
  nodes,
  members,
  analysis,
  displacementDisplayScale,
  activeTool,
  memberStartNodeId,
  selectedEntity,
  onCanvasClick,
  onNodeClick,
  onMemberClick,
  onMoveNode,
  onSetActiveTool,
  onSetSelectedNodeSupport,
  onSetSelectedMemberAxialStiffness,
  onSetSelectedNodeHorizontalLoad,
  onSetSelectedNodeVerticalLoad,
  onDeleteNode,
  onDeleteMember,
}: Editor2DProps) {
  const [previewPoint, setPreviewPoint] = useState<{ x: number; y: number } | null>(null)
  const dragNodeIdRef = useRef<string | null>(null)
  const dragMovedRef = useRef(false)

  const memberStartNode = useMemo(
    () => nodes.find((node) => node.id === memberStartNodeId) ?? null,
    [nodes, memberStartNodeId],
  )

  const selectedNode = useMemo(
    () =>
      selectedEntity?.type === 'node'
        ? nodes.find((node) => node.id === selectedEntity.id) ?? null
        : null,
    [nodes, selectedEntity],
  )

  const selectedMember = useMemo(
    () =>
      selectedEntity?.type === 'member'
        ? members.find((member) => member.id === selectedEntity.id) ?? null
        : null,
    [members, selectedEntity],
  )

  const displacementByNodeId = useMemo(
    () => new Map(analysis.displacements.map((displacement) => [displacement.nodeId, displacement])),
    [analysis.displacements],
  )

  const reactionByNodeId = useMemo(
    () => new Map(analysis.reactions.map((reaction) => [reaction.nodeId, reaction])),
    [analysis.reactions],
  )

  const memberResultByMemberId = useMemo(
    () => new Map(analysis.memberResults.map((result) => [result.memberId, result])),
    [analysis.memberResults],
  )

  const getSvgPoint = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const scaleX = EDITOR_WIDTH / rect.width
    const scaleY = EDITOR_HEIGHT / rect.height
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    }
  }

  const getSnappedSvgPoint = (event: MouseEvent<SVGSVGElement>) => {
    const point = getSvgPoint(event)

    return {
      x: snapToGrid(point.x),
      y: snapToGrid(point.y),
    }
  }

  const handleCanvasClick = (event: MouseEvent<SVGSVGElement>) => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false
      return
    }

    const point = getSnappedSvgPoint(event)
    onCanvasClick(point.x, point.y)
    setPreviewPoint(point)
  }

  const handleMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    const point = getSnappedSvgPoint(event)

    if (dragNodeIdRef.current) {
      dragMovedRef.current = true
      onMoveNode(dragNodeIdRef.current, point.x, point.y)
    }

    if (activeTool === 'member' && memberStartNode) {
      setPreviewPoint(point)
    }
  }

  const previewLengthInMeters =
    memberStartNode && previewPoint
      ? pixelsToMeters(
          Math.hypot(previewPoint.x - memberStartNode.x, previewPoint.y - memberStartNode.y),
        )
      : null

  const previewMidpoint =
    memberStartNode && previewPoint
      ? {
          x: (memberStartNode.x + previewPoint.x) / 2,
          y: (memberStartNode.y + previewPoint.y) / 2,
        }
      : null

  const isPreviewVisible =
    Boolean(memberStartNode && previewPoint) &&
    !(memberStartNode?.x === previewPoint?.x && memberStartNode?.y === previewPoint?.y)

  const handleMouseUp = () => {
    dragNodeIdRef.current = null
  }

  const selectedNodeSupport = normalizeSupportType(
    selectedNode?.support as RuntimeSupportType | undefined,
  )
  const selectedHorizontalLoad = selectedNode?.horizontalLoad
  const selectedVerticalLoad = selectedNode?.verticalLoad

  const handleHorizontalMagnitudeChange = (value: string) => {
    const magnitudeKn = Number(value)
    onSetSelectedNodeHorizontalLoad(
      Number.isFinite(magnitudeKn) ? magnitudeKn : 0,
      selectedHorizontalLoad?.direction ?? 'right',
    )
  }

  const handleVerticalMagnitudeChange = (value: string) => {
    const magnitudeKn = Number(value)
    onSetSelectedNodeVerticalLoad(
      Number.isFinite(magnitudeKn) ? magnitudeKn : 0,
      selectedVerticalLoad?.direction ?? 'down',
    )
  }

  const horizontalDirectionOptions: HorizontalLoadDirection[] = ['left', 'right']
  const verticalDirectionOptions: VerticalLoadDirection[] = ['up', 'down']
  const isStableAnalysis =
    analysis.status === 'stable-determinate' || analysis.status === 'stable-indeterminate'

  const getNodeClassName = (nodeId: string) => {
    const isSelected = selectedEntity?.type === 'node' && selectedEntity.id === nodeId
    const isMemberStart = memberStartNodeId === nodeId

    if (isSelected || isMemberStart) {
      return 'node-circle is-selected'
    }

    return 'node-circle'
  }

  const getMemberClassName = (memberId: string) => {
    const isSelected = selectedEntity?.type === 'member' && selectedEntity.id === memberId
    return isSelected ? 'member-line is-selected' : 'member-line'
  }

  return (
    <div className="panel">
      <div className="panel-header editor-header">
        <div className="editor-toolbar" aria-label="2D editor toolbar">
          <div className="tool-group">
            {TOOL_OPTIONS.map((tool) => (
              <button
                key={tool.value}
                type="button"
                className={activeTool === tool.value ? 'tool-button is-active' : 'tool-button'}
                onClick={() => onSetActiveTool(tool.value)}
              >
                {tool.label}
              </button>
            ))}
          </div>

          {selectedNode ? (
            <div className="node-properties" aria-label="Selected node properties">
              <div className="tool-group tool-group-supports" aria-label="Selected node supports">
                {SUPPORT_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={
                      selectedNodeSupport === option.value ||
                      (selectedNodeSupport === undefined && option.value === undefined)
                        ? 'tool-button is-active'
                        : 'tool-button'
                    }
                    onClick={() => onSetSelectedNodeSupport(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="load-editor-group" aria-label="Node loads">
                <div className="load-editor">
                  <span className="load-label">H</span>
                  <div className="direction-toggle">
                    {horizontalDirectionOptions.map((direction) => (
                      <button
                        key={direction}
                        type="button"
                        className={
                          (selectedHorizontalLoad?.direction ?? 'right') === direction
                            ? 'tool-button is-active'
                            : 'tool-button'
                        }
                        onClick={() =>
                          onSetSelectedNodeHorizontalLoad(
                            selectedHorizontalLoad?.magnitudeKn ?? 0,
                            direction,
                          )
                        }
                      >
                        {direction === 'left' ? '←' : '→'}
                      </button>
                    ))}
                  </div>
                  <input
                    className="load-input"
                    type="number"
                    min="0"
                    step="0.1"
                    value={selectedHorizontalLoad?.magnitudeKn ?? 0}
                    onChange={(event) => handleHorizontalMagnitudeChange(event.target.value)}
                  />
                  <span className="load-unit">kN</span>
                </div>

                <div className="load-editor">
                  <span className="load-label">V</span>
                  <div className="direction-toggle">
                    {verticalDirectionOptions.map((direction) => (
                      <button
                        key={direction}
                        type="button"
                        className={
                          (selectedVerticalLoad?.direction ?? 'down') === direction
                            ? 'tool-button is-active'
                            : 'tool-button'
                        }
                        onClick={() =>
                          onSetSelectedNodeVerticalLoad(
                            selectedVerticalLoad?.magnitudeKn ?? 0,
                            direction,
                          )
                        }
                      >
                        {direction === 'up' ? '↑' : '↓'}
                      </button>
                    ))}
                  </div>
                  <input
                    className="load-input"
                    type="number"
                    min="0"
                    step="0.1"
                    value={selectedVerticalLoad?.magnitudeKn ?? 0}
                    onChange={(event) => handleVerticalMagnitudeChange(event.target.value)}
                  />
                  <span className="load-unit">kN</span>
                </div>
              </div>
            </div>
          ) : selectedMember ? (
            <div className="member-properties" aria-label="Selected member properties">
              <div className="load-editor">
                <span className="load-label">EA</span>
                <input
                  className="load-input member-stiffness-input"
                  type="number"
                  min="1"
                  step="1000"
                  value={selectedMember.axialStiffnessKn}
                  onChange={(event) =>
                    onSetSelectedMemberAxialStiffness(
                      Math.max(1, Number(event.target.value) || selectedMember.axialStiffnessKn),
                    )
                  }
                />
                <span className="load-unit">kN</span>
              </div>
            </div>
          ) : null}
        </div>

        <p className="editor-help">
          {activeTool === 'member'
            ? 'Member tool: click a start point on a node or empty space, then click the end point to create the member. Points snap to the 0.1 m grid.'
            : activeTool === 'node'
              ? 'Node tool: click anywhere in the 2D view to place a standalone node on the 0.1 m grid.'
              : 'Select tool: click a node or member to select it, drag a node with 0.1 m snap, and press Delete or Backspace to remove the selected item.'}
        </p>
      </div>

      <svg
        className="editor-surface"
        viewBox={`0 0 ${EDITOR_WIDTH} ${EDITOR_HEIGHT}`}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        role="img"
        aria-label="2D truss editor"
      >
        <defs>
          <marker
            id="axis-arrow-x"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" className="axis-arrow-x" />
          </marker>
          <marker
            id="axis-arrow-z"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" className="axis-arrow-z" />
          </marker>
        </defs>

        <rect x="0" y="0" width={EDITOR_WIDTH} height={EDITOR_HEIGHT} fill="transparent" />

        <line
          x1={AXIS_MARGIN}
          y1={EDITOR_HEIGHT - AXIS_MARGIN}
          x2={AXIS_MARGIN + 72}
          y2={EDITOR_HEIGHT - AXIS_MARGIN}
          className="axis-line axis-line-x"
          markerEnd="url(#axis-arrow-x)"
          pointerEvents="none"
        />
        <line
          x1={AXIS_MARGIN}
          y1={EDITOR_HEIGHT - AXIS_MARGIN}
          x2={AXIS_MARGIN}
          y2={EDITOR_HEIGHT - AXIS_MARGIN - 72}
          className="axis-line axis-line-z"
          markerEnd="url(#axis-arrow-z)"
          pointerEvents="none"
        />
        <text
          x={AXIS_MARGIN + 84}
          y={EDITOR_HEIGHT - AXIS_MARGIN + 5}
          className="axis-label axis-label-x"
        >
          X
        </text>
        <text
          x={AXIS_MARGIN - 4}
          y={EDITOR_HEIGHT - AXIS_MARGIN - 84}
          className="axis-label axis-label-z"
        >
          Z
        </text>
        <text x={AXIS_MARGIN} y={EDITOR_HEIGHT - AXIS_MARGIN + 26} className="axis-hint">
          Y axis points out of the screen. Grid spacing: 0.1 m
        </text>

        {members.map((member) => {
          const nodeA = nodes.find((node) => node.id === member.nodeAId)
          const nodeB = nodes.find((node) => node.id === member.nodeBId)

          if (!nodeA || !nodeB) {
            return null
          }

          const lengthInMeters =
            pixelsToMeters(Math.hypot(nodeB.x - nodeA.x, nodeB.y - nodeA.y))
          const midX = (nodeA.x + nodeB.x) / 2
          const midY = (nodeA.y + nodeB.y) / 2

          return (
            <g key={member.id}>
              <line
                x1={nodeA.x}
                y1={nodeA.y}
                x2={nodeB.x}
                y2={nodeB.y}
                className={getMemberClassName(member.id)}
                onClick={(event) => {
                  event.stopPropagation()
                  onMemberClick(member.id)
                }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onDeleteMember(member.id)
                }}
              />
              <text x={midX} y={midY - 10} className="member-length" textAnchor="middle">
                {lengthInMeters.toFixed(2)} m
              </text>
              {isStableAnalysis ? (
                <MemberForceLabel
                  midX={midX}
                  midY={midY}
                  result={memberResultByMemberId.get(member.id)}
                />
              ) : null}
            </g>
          )
        })}

        {isStableAnalysis && displacementDisplayScale > 0 ? (
          <DisplacedShapeOverlay
            nodes={nodes}
            members={members}
            displacementByNodeId={displacementByNodeId}
            displayScale={displacementDisplayScale}
          />
        ) : null}

        {memberStartNode && isPreviewVisible && previewPoint && previewMidpoint && previewLengthInMeters ? (
          <g pointerEvents="none">
            <line
              x1={memberStartNode.x}
              y1={memberStartNode.y}
              x2={previewPoint.x}
              y2={previewPoint.y}
              className="member-line member-line-preview"
            />
            <text
              x={previewMidpoint.x}
              y={previewMidpoint.y - 10}
              className="member-length"
              textAnchor="middle"
            >
              {previewLengthInMeters.toFixed(2)} m
            </text>
          </g>
        ) : null}

        {nodes.map((node) => (
          <g key={node.id}>
            <SupportSymbol node={node} />
            <NodeLoads node={node} />
            {isStableAnalysis ? (
              <ReactionOverlay node={node} reaction={reactionByNodeId.get(node.id)} />
            ) : null}
            <circle
              cx={node.x}
              cy={node.y}
              r={NODE_RADIUS}
              className={getNodeClassName(node.id)}
              onMouseDown={(event) => {
                if (activeTool !== 'select') {
                  return
                }

                event.stopPropagation()
                onNodeClick(node.id)
                dragNodeIdRef.current = node.id
                dragMovedRef.current = false
              }}
              onClick={(event) => {
                event.stopPropagation()
                if (dragMovedRef.current) {
                  dragMovedRef.current = false
                  return
                }
                onNodeClick(node.id)
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onDeleteNode(node.id)
              }}
            />
          </g>
        ))}
      </svg>
    </div>
  )
}

function SupportSymbol({ node }: { node: Node2D }) {
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

function NodeLoads({ node }: { node: Node2D }) {
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
        <text
          x={offsetX + 10}
          y={(node.y + endY) / 2 - 6}
          className="load-label-text"
        >
          {node.verticalLoad.magnitudeKn.toFixed(1)} kN
        </text>
      </g>,
    )
  }

  return <>{loadElements}</>
}

function clampArrowLength(magnitudeKn: number) {
  return Math.min(72, Math.max(28, 20 + magnitudeKn * 4))
}

function DisplacedShapeOverlay({
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

function MemberForceLabel({
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

function ReactionOverlay({
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
          dx={reaction.xKn > 0 ? clampArrowLength(Math.abs(reaction.xKn)) : -clampArrowLength(Math.abs(reaction.xKn))}
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
          dy={reaction.zKn > 0 ? -clampArrowLength(Math.abs(reaction.zKn)) : clampArrowLength(Math.abs(reaction.zKn))}
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

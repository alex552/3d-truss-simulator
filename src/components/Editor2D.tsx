import { useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { EDITOR_HEIGHT, EDITOR_WIDTH, GRID_SIZE_PX } from '../constants'
import type { Member, Node2D, SupportType } from '../types'
import type { EditorTool, SelectedEntity } from '../App'

type Editor2DProps = {
  nodes: Node2D[]
  members: Member[]
  activeTool: EditorTool
  memberStartNodeId: string | null
  selectedEntity: SelectedEntity
  onCanvasClick: (x: number, y: number) => void
  onNodeClick: (nodeId: string) => void
  onMemberClick: (memberId: string) => void
  onMoveNode: (nodeId: string, x: number, y: number) => void
  onSetActiveTool: (tool: EditorTool) => void
  onSetSelectedNodeSupport: (support: SupportType | undefined) => void
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
  { value: 'fixed', label: 'Fixed' },
  { value: 'pinned', label: 'Pinned' },
  { value: 'roller-x', label: 'Roller X' },
  { value: 'roller-z', label: 'Roller Z' },
]

export function Editor2D({
  nodes,
  members,
  activeTool,
  memberStartNodeId,
  selectedEntity,
  onCanvasClick,
  onNodeClick,
  onMemberClick,
  onMoveNode,
  onSetActiveTool,
  onSetSelectedNodeSupport,
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

  const getSvgPoint = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const scaleX = EDITOR_WIDTH / rect.width
    const scaleY = EDITOR_HEIGHT / rect.height
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    }
  }

  const handleCanvasClick = (event: MouseEvent<SVGSVGElement>) => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false
      return
    }

    const point = getSvgPoint(event)
    onCanvasClick(point.x, point.y)
    setPreviewPoint(point)
  }

  const handleMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    const point = getSvgPoint(event)

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
      ? Math.hypot(previewPoint.x - memberStartNode.x, previewPoint.y - memberStartNode.y) /
        GRID_SIZE_PX
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

  const selectedNodeSupport = selectedNode?.support

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
          ) : null}
        </div>

        <p className="editor-help">
          {activeTool === 'member'
            ? 'Member tool: click a start point on a node or empty space, then click the end point to create the member.'
            : activeTool === 'node'
              ? 'Node tool: click anywhere in the 2D view to place a standalone node.'
              : 'Select tool: click a node or member to select it, drag a node to move it, and press Delete or Backspace to remove the selected item.'}
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
          Y axis points out of the screen
        </text>

        {members.map((member) => {
          const nodeA = nodes.find((node) => node.id === member.nodeAId)
          const nodeB = nodes.find((node) => node.id === member.nodeBId)

          if (!nodeA || !nodeB) {
            return null
          }

          const lengthInMeters =
            Math.hypot(nodeB.x - nodeA.x, nodeB.y - nodeA.y) / GRID_SIZE_PX
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
            </g>
          )
        })}

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
  if (!node.support) {
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

  if (node.support === 'fixed') {
    return (
      <g className="support-symbol" pointerEvents="none">
        <rect x={node.x - 12} y={baseY} width={24} height={12} rx={2} className="support-shape" />
        <line x1={node.x} y1={node.y + 8} x2={node.x} y2={baseY} className="support-link" />
      </g>
    )
  }

  if (node.support === 'pinned') {
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

  if (node.support === 'roller-x') {
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

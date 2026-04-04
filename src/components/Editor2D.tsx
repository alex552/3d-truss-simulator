import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { EDITOR_HEIGHT, EDITOR_WIDTH, GRID_SIZE_PX } from '../constants'
import type { Member, Node2D } from '../types'

type Editor2DProps = {
  nodes: Node2D[]
  members: Member[]
  drawingNodeId: string | null
  onCanvasClick: (x: number, y: number) => void
  onNodeClick: (nodeId: string) => void
  onDeleteNode: (nodeId: string) => void
  onDeleteMember: (memberId: string) => void
}

const NODE_RADIUS = 8
const AXIS_MARGIN = 28

export function Editor2D({
  nodes,
  members,
  drawingNodeId,
  onCanvasClick,
  onNodeClick,
  onDeleteNode,
  onDeleteMember,
}: Editor2DProps) {
  const [previewPoint, setPreviewPoint] = useState<{ x: number; y: number } | null>(null)

  const drawingNode = useMemo(
    () => nodes.find((node) => node.id === drawingNodeId) ?? null,
    [nodes, drawingNodeId],
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
    const point = getSvgPoint(event)
    onCanvasClick(point.x, point.y)
    setPreviewPoint(point)
  }

  const handleMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    if (!drawingNode) {
      return
    }

    setPreviewPoint(getSvgPoint(event))
  }

  const previewLengthInMeters =
    drawingNode && previewPoint
      ? Math.hypot(previewPoint.x - drawingNode.x, previewPoint.y - drawingNode.y) / GRID_SIZE_PX
      : null

  const previewMidpoint =
    drawingNode && previewPoint
      ? {
          x: (drawingNode.x + previewPoint.x) / 2,
          y: (drawingNode.y + previewPoint.y) / 2,
        }
      : null

  const isPreviewVisible =
    Boolean(drawingNode && previewPoint) &&
    !(drawingNode?.x === previewPoint?.x && drawingNode?.y === previewPoint?.y)

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>2D Editor</h2>
          <p>
            Draw on the X/Z plane. Click to start a member, move to preview its length,
            click again to finish it, and right-click a node or member to delete it.
          </p>
        </div>
      </div>

      <svg
        className="editor-surface"
        viewBox={`0 0 ${EDITOR_WIDTH} ${EDITOR_HEIGHT}`}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
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
                className="member-line"
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

        {drawingNode && isPreviewVisible && previewPoint && previewMidpoint && previewLengthInMeters ? (
          <g pointerEvents="none">
            <line
              x1={drawingNode.x}
              y1={drawingNode.y}
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
          <circle
            key={node.id}
            cx={node.x}
            cy={node.y}
            r={NODE_RADIUS}
            className={drawingNodeId === node.id ? 'node-circle is-selected' : 'node-circle'}
            onClick={(event) => {
              event.stopPropagation()
              onNodeClick(node.id)
            }}
            onContextMenu={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onDeleteNode(node.id)
            }}
          />
        ))}
      </svg>
    </div>
  )
}

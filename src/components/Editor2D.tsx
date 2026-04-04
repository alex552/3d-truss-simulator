import type { MouseEvent } from 'react'
import type { Member, Node2D } from '../types'

type Editor2DProps = {
  nodes: Node2D[]
  members: Member[]
  selectedNodeId: string | null
  onAddNode: (x: number, y: number) => void
  onSelectNode: (nodeId: string) => void
  onDeleteNode: (nodeId: string) => void
  onDeleteMember: (memberId: string) => void
}

const WIDTH = 520
const HEIGHT = 520
const NODE_RADIUS = 8
const AXIS_MARGIN = 28

export function Editor2D({
  nodes,
  members,
  selectedNodeId,
  onAddNode,
  onSelectNode,
  onDeleteNode,
  onDeleteMember,
}: Editor2DProps) {
  const handleCanvasClick = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const scaleX = WIDTH / rect.width
    const scaleY = HEIGHT / rect.height
    const x = (event.clientX - rect.left) * scaleX
    const y = (event.clientY - rect.top) * scaleY
    onAddNode(x, y)
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>2D Editor</h2>
          <p>
            Draw on the X/Z plane. Click empty space to add nodes, click two nodes to create
            a member, and right-click a node or member to delete it.
          </p>
        </div>
      </div>

      <svg
        className="editor-surface"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        onClick={handleCanvasClick}
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

        <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="transparent" />

        <line
          x1={AXIS_MARGIN}
          y1={HEIGHT - AXIS_MARGIN}
          x2={AXIS_MARGIN + 72}
          y2={HEIGHT - AXIS_MARGIN}
          className="axis-line axis-line-x"
          markerEnd="url(#axis-arrow-x)"
          pointerEvents="none"
        />
        <line
          x1={AXIS_MARGIN}
          y1={HEIGHT - AXIS_MARGIN}
          x2={AXIS_MARGIN}
          y2={HEIGHT - AXIS_MARGIN - 72}
          className="axis-line axis-line-z"
          markerEnd="url(#axis-arrow-z)"
          pointerEvents="none"
        />
        <text x={AXIS_MARGIN + 84} y={HEIGHT - AXIS_MARGIN + 5} className="axis-label axis-label-x">
          X
        </text>
        <text x={AXIS_MARGIN - 4} y={HEIGHT - AXIS_MARGIN - 84} className="axis-label axis-label-z">
          Z
        </text>
        <text x={AXIS_MARGIN} y={HEIGHT - AXIS_MARGIN + 26} className="axis-hint">
          Y axis points out of the screen
        </text>

        {members.map((member) => {
          const nodeA = nodes.find((node) => node.id === member.nodeAId)
          const nodeB = nodes.find((node) => node.id === member.nodeBId)

          if (!nodeA || !nodeB) {
            return null
          }

          return (
            <line
              key={member.id}
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
          )
        })}

        {nodes.map((node) => (
          <circle
            key={node.id}
            cx={node.x}
            cy={node.y}
            r={NODE_RADIUS}
            className={selectedNodeId === node.id ? 'node-circle is-selected' : 'node-circle'}
            onClick={(event) => {
              event.stopPropagation()
              onSelectNode(node.id)
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

import type { MouseEvent } from 'react'
import type { Member, Node2D } from '../types'

type Editor2DProps = {
  nodes: Node2D[]
  members: Member[]
  selectedNodeId: string | null
  onAddNode: (x: number, y: number) => void
  onSelectNode: (nodeId: string) => void
}

const WIDTH = 520
const HEIGHT = 520
const NODE_RADIUS = 8

export function Editor2D({
  nodes,
  members,
  selectedNodeId,
  onAddNode,
  onSelectNode,
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
          <p>Click empty space to add nodes. Click two nodes to create a member.</p>
        </div>
      </div>

      <svg
        className="editor-surface"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        onClick={handleCanvasClick}
        role="img"
        aria-label="2D truss editor"
      >
        <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="transparent" />

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
          />
        ))}
      </svg>
    </div>
  )
}

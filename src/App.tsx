import { useState } from 'react'
import { Editor2D } from './components/Editor2D'
import { Truss3DView } from './components/Truss3DView'
import type { Member, Node2D } from './types'

export default function App() {
  const [nodes, setNodes] = useState<Node2D[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [drawingNodeId, setDrawingNodeId] = useState<string | null>(null)
  const [show3D, setShow3D] = useState(true)

  const createNode = (x: number, y: number): Node2D => ({
    id: crypto.randomUUID(),
    x,
    y,
  })

  const handleCanvasClick = (x: number, y: number) => {
    const newNode = createNode(x, y)

    if (!drawingNodeId) {
      setNodes((currentNodes) => [...currentNodes, newNode])
      setDrawingNodeId(newNode.id)
      return
    }

    setNodes((currentNodes) => [...currentNodes, newNode])
    setMembers((currentMembers) => [
      ...currentMembers,
      {
        id: crypto.randomUUID(),
        nodeAId: drawingNodeId,
        nodeBId: newNode.id,
      },
    ])
    setDrawingNodeId(null)
  }

  const handleNodeClick = (nodeId: string) => {
    if (!drawingNodeId) {
      setDrawingNodeId(nodeId)
      return
    }

    if (drawingNodeId === nodeId) {
      setDrawingNodeId(null)
      return
    }

    setMembers((currentMembers) => [
      ...currentMembers,
      {
        id: crypto.randomUUID(),
        nodeAId: drawingNodeId,
        nodeBId: nodeId,
      },
    ])
    setDrawingNodeId(null)
  }

  const handleDeleteNode = (nodeId: string) => {
    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId))
    setMembers((currentMembers) =>
      currentMembers.filter(
        (member) => member.nodeAId !== nodeId && member.nodeBId !== nodeId,
      ),
    )
    setDrawingNodeId((currentDrawingNodeId) =>
      currentDrawingNodeId === nodeId ? null : currentDrawingNodeId,
    )
  }

  const handleDeleteMember = (memberId: string) => {
    setMembers((currentMembers) =>
      currentMembers.filter((member) => member.id !== memberId),
    )
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <h1>Truss Playground</h1>
          <p>Phase 1 proof of concept: sketch a truss on the X/Z plane, then inspect it in 3D.</p>
        </div>

        <button
          type="button"
          className="view-button"
          onClick={() => setShow3D((currentValue) => !currentValue)}
        >
          {show3D ? 'Hide 3D View' : 'Show 3D View'}
        </button>
      </section>

      <section className={show3D ? 'workspace workspace-two-up' : 'workspace'}>
        <Editor2D
          nodes={nodes}
          members={members}
          drawingNodeId={drawingNodeId}
          onCanvasClick={handleCanvasClick}
          onNodeClick={handleNodeClick}
          onDeleteNode={handleDeleteNode}
          onDeleteMember={handleDeleteMember}
        />

        {show3D ? <Truss3DView nodes={nodes} members={members} /> : null}
      </section>
    </main>
  )
}

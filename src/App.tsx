import { useState } from 'react'
import { Editor2D } from './components/Editor2D'
import { Truss3DView } from './components/Truss3DView'
import type { Member, Node2D } from './types'

export default function App() {
  const [nodes, setNodes] = useState<Node2D[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [show3D, setShow3D] = useState(false)

  const handleAddNode = (x: number, y: number) => {
    setNodes((currentNodes) => [
      ...currentNodes,
      {
        id: crypto.randomUUID(),
        x,
        y,
      },
    ])
  }

  const handleSelectNode = (nodeId: string) => {
    if (!selectedNodeId) {
      setSelectedNodeId(nodeId)
      return
    }

    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null)
      return
    }

    setMembers((currentMembers) => [
      ...currentMembers,
      {
        id: crypto.randomUUID(),
        nodeAId: selectedNodeId,
        nodeBId: nodeId,
      },
    ])
    setSelectedNodeId(null)
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <h1>Truss Playground</h1>
          <p>Phase 1 proof of concept: sketch a 2D truss, then inspect it in 3D.</p>
        </div>

        <button type="button" className="view-button" onClick={() => setShow3D(true)}>
          View in 3D
        </button>
      </section>

      <section className={show3D ? 'workspace workspace-two-up' : 'workspace'}>
        <Editor2D
          nodes={nodes}
          members={members}
          selectedNodeId={selectedNodeId}
          onAddNode={handleAddNode}
          onSelectNode={handleSelectNode}
        />

        {show3D ? <Truss3DView nodes={nodes} members={members} /> : null}
      </section>
    </main>
  )
}

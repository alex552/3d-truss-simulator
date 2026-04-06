import { useEffect, useMemo, useState } from 'react'
import { AnalysisPanel } from './components/AnalysisPanel'
import { Editor2D } from './components/Editor2D'
import { Truss3DView } from './components/Truss3DView'
import { analyzeTruss } from './lib/analysis'
import { DEFAULT_MEMBER_AXIAL_STIFFNESS_KN } from './lib/truss-model'
import { PIXELS_PER_METER } from './constants'
import type {
  HorizontalLoadDirection,
  Member,
  Node2D,
  SupportType,
  VerticalLoadDirection,
} from './types'

export type EditorTool = 'select' | 'node' | 'member'

export type SelectedEntity =
  | { type: 'node'; id: string }
  | { type: 'member'; id: string }
  | null

export default function App() {
  const [nodes, setNodes] = useState<Node2D[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [memberStartNodeId, setMemberStartNodeId] = useState<string | null>(null)
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null)
  const [show3D, setShow3D] = useState(true)
  const [activeTool, setActiveTool] = useState<EditorTool>('member')

  const createNode = (x: number, y: number): Node2D => ({
    id: crypto.randomUUID(),
    x,
    y,
  })

  const handleCanvasClick = (x: number, y: number) => {
    if (activeTool === 'select') {
      setSelectedEntity(null)
      return
    }

    if (activeTool === 'node') {
      const newNode = createNode(x, y)
      setNodes((currentNodes) => [...currentNodes, newNode])
      setSelectedEntity({ type: 'node', id: newNode.id })
      return
    }

    if (activeTool !== 'member') {
      return
    }

    const newNode = createNode(x, y)

    if (!memberStartNodeId) {
      setNodes((currentNodes) => [...currentNodes, newNode])
      setMemberStartNodeId(newNode.id)
      setSelectedEntity({ type: 'node', id: newNode.id })
      return
    }

    setNodes((currentNodes) => [...currentNodes, newNode])
    setMembers((currentMembers) => [
      ...currentMembers,
      {
        id: crypto.randomUUID(),
        nodeAId: memberStartNodeId,
        nodeBId: newNode.id,
        axialStiffnessKn: DEFAULT_MEMBER_AXIAL_STIFFNESS_KN,
      },
    ])
    setMemberStartNodeId(null)
    setSelectedEntity(null)
  }

  const handleNodeClick = (nodeId: string) => {
    if (activeTool === 'select') {
      setSelectedEntity({ type: 'node', id: nodeId })
      return
    }

    if (activeTool === 'node') {
      return
    }

    if (!memberStartNodeId) {
      setMemberStartNodeId(nodeId)
      setSelectedEntity({ type: 'node', id: nodeId })
      return
    }

    if (memberStartNodeId === nodeId) {
      setMemberStartNodeId(null)
      setSelectedEntity({ type: 'node', id: nodeId })
      return
    }

    setMembers((currentMembers) => [
      ...currentMembers,
      {
        id: crypto.randomUUID(),
        nodeAId: memberStartNodeId,
        nodeBId: nodeId,
        axialStiffnessKn: DEFAULT_MEMBER_AXIAL_STIFFNESS_KN,
      },
    ])
    setMemberStartNodeId(null)
    setSelectedEntity(null)
  }

  const handleMemberClick = (memberId: string) => {
    if (activeTool !== 'select') {
      return
    }

    setSelectedEntity({ type: 'member', id: memberId })
  }

  const handleMoveNode = (nodeId: string, x: number, y: number) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              x,
              y,
            }
          : node,
      ),
    )
  }

  const handleDeleteNode = (nodeId: string) => {
    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId))
    setMembers((currentMembers) =>
      currentMembers.filter(
        (member) => member.nodeAId !== nodeId && member.nodeBId !== nodeId,
      ),
    )
    setMemberStartNodeId((currentStartNodeId) =>
      currentStartNodeId === nodeId ? null : currentStartNodeId,
    )
    setSelectedEntity((currentSelection) =>
      currentSelection?.type === 'node' && currentSelection.id === nodeId ? null : currentSelection,
    )
  }

  const handleDeleteMember = (memberId: string) => {
    setMembers((currentMembers) =>
      currentMembers.filter((member) => member.id !== memberId),
    )
    setSelectedEntity((currentSelection) =>
      currentSelection?.type === 'member' && currentSelection.id === memberId
        ? null
        : currentSelection,
    )
  }

  const handleSetActiveTool = (tool: EditorTool) => {
    setActiveTool(tool)
    if (tool !== 'member') {
      setMemberStartNodeId(null)
    }
  }

  const handleSetSelectedNodeSupport = (support: SupportType | undefined) => {
    if (selectedEntity?.type !== 'node') {
      return
    }

    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === selectedEntity.id
          ? {
              ...node,
              support,
            }
          : node,
      ),
    )
  }

  const handleSetSelectedMemberAxialStiffness = (axialStiffnessKn: number) => {
    if (selectedEntity?.type !== 'member') {
      return
    }

    setMembers((currentMembers) =>
      currentMembers.map((member) =>
        member.id === selectedEntity.id
          ? {
              ...member,
              axialStiffnessKn,
            }
          : member,
      ),
    )
  }

  const analysis = useMemo(() => analyzeTruss(nodes, members), [nodes, members])

  const displacementDisplayScale = useMemo(() => {
    if (analysis.maxDisplacementMeters <= 0) {
      return 0
    }

    const maxDisplacementPx = analysis.maxDisplacementMeters * PIXELS_PER_METER
    return maxDisplacementPx > 0 ? 24 / maxDisplacementPx : 0
  }, [analysis.maxDisplacementMeters])

  const handleSetSelectedNodeHorizontalLoad = (
    magnitudeKn: number,
    direction: HorizontalLoadDirection,
  ) => {
    if (selectedEntity?.type !== 'node') {
      return
    }

    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === selectedEntity.id
          ? {
              ...node,
              horizontalLoad:
                magnitudeKn > 0
                  ? {
                      magnitudeKn,
                      direction,
                    }
                  : undefined,
            }
          : node,
      ),
    )
  }

  const handleSetSelectedNodeVerticalLoad = (
    magnitudeKn: number,
    direction: VerticalLoadDirection,
  ) => {
    if (selectedEntity?.type !== 'node') {
      return
    }

    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === selectedEntity.id
          ? {
              ...node,
              verticalLoad:
                magnitudeKn > 0
                  ? {
                      magnitudeKn,
                      direction,
                    }
                  : undefined,
            }
          : node,
      ),
    )
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') {
        return
      }

      const target = event.target as HTMLElement | null
      const tagName = target?.tagName ?? ''
      if (target?.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA') {
        return
      }

      if (!selectedEntity) {
        return
      }

      event.preventDefault()

      if (selectedEntity.type === 'node') {
        handleDeleteNode(selectedEntity.id)
        return
      }

      handleDeleteMember(selectedEntity.id)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedEntity])

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <h1>Truss Playground</h1>
          <p>Sketch a truss on the X/Z plane, add supports, then inspect it in 3D.</p>
        </div>

        <div className="hero-actions">
          <button
            type="button"
            className="view-button"
            onClick={() => setShow3D((currentValue) => !currentValue)}
          >
            {show3D ? 'Hide 3D View' : 'Show 3D View'}
          </button>
        </div>
      </section>

      <section className={show3D ? 'workspace workspace-two-up' : 'workspace'}>
        <Editor2D
          nodes={nodes}
          members={members}
          analysis={analysis}
          displacementDisplayScale={displacementDisplayScale}
          activeTool={activeTool}
          memberStartNodeId={memberStartNodeId}
          selectedEntity={selectedEntity}
          onCanvasClick={handleCanvasClick}
          onNodeClick={handleNodeClick}
          onMemberClick={handleMemberClick}
          onMoveNode={handleMoveNode}
          onSetActiveTool={handleSetActiveTool}
          onSetSelectedNodeSupport={handleSetSelectedNodeSupport}
          onSetSelectedMemberAxialStiffness={handleSetSelectedMemberAxialStiffness}
          onSetSelectedNodeHorizontalLoad={handleSetSelectedNodeHorizontalLoad}
          onSetSelectedNodeVerticalLoad={handleSetSelectedNodeVerticalLoad}
          onDeleteNode={handleDeleteNode}
          onDeleteMember={handleDeleteMember}
        />

        {show3D ? <Truss3DView nodes={nodes} members={members} /> : null}
      </section>

      <AnalysisPanel
        analysis={analysis}
        nodes={nodes}
        members={members}
        displacementDisplayScale={displacementDisplayScale}
      />
    </main>
  )
}

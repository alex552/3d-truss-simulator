import { useEffect, useMemo, useRef, useState } from 'react'
import { Editor2D } from './components/Editor2D'
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

export type EditorTool = 'select' | 'drag' | 'node' | 'member'

export type SelectedEntity =
  | { type: 'node'; id: string }
  | { type: 'member'; id: string }
  | null

type ModelSnapshot = {
  nodes: Node2D[]
  members: Member[]
}

type PersistedTrussModel = {
  version: 1
  nodes: Node2D[]
  members: Member[]
}

const MAX_HISTORY_STEPS = 100
const MODEL_FILE_EXTENSION = '.truss.json'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isHorizontalLoad(value: unknown): value is Node2D['horizontalLoad'] {
  if (!isRecord(value)) {
    return false
  }

  return (
    isFiniteNumber(value.magnitudeKn) &&
    (value.direction === 'left' || value.direction === 'right')
  )
}

function isVerticalLoad(value: unknown): value is Node2D['verticalLoad'] {
  if (!isRecord(value)) {
    return false
  }

  return (
    isFiniteNumber(value.magnitudeKn) &&
    (value.direction === 'up' || value.direction === 'down')
  )
}

function isNode2D(value: unknown): value is Node2D {
  if (!isRecord(value)) {
    return false
  }

  const hasValidSupport =
    value.support === undefined ||
    value.support === 'pinned' ||
    value.support === 'roller-x' ||
    value.support === 'roller-z'

  return (
    typeof value.id === 'string' &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    hasValidSupport &&
    (value.horizontalLoad === undefined || isHorizontalLoad(value.horizontalLoad)) &&
    (value.verticalLoad === undefined || isVerticalLoad(value.verticalLoad))
  )
}

function isMember(value: unknown): value is Member {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.nodeAId === 'string' &&
    typeof value.nodeBId === 'string' &&
    isFiniteNumber(value.axialStiffnessKn)
  )
}

function parsePersistedModel(content: string): ModelSnapshot | null {
  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch {
    return null
  }

  if (!isRecord(parsed)) {
    return null
  }

  if (parsed.version !== 1 || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.members)) {
    return null
  }

  if (!parsed.nodes.every(isNode2D) || !parsed.members.every(isMember)) {
    return null
  }

  return {
    nodes: parsed.nodes,
    members: parsed.members,
  }
}

export default function App() {
  const [nodes, setNodes] = useState<Node2D[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [memberStartNodeId, setMemberStartNodeId] = useState<string | null>(null)
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null)
  const [activeTool, setActiveTool] = useState<EditorTool>('member')
  const [showForceResults, setShowForceResults] = useState(true)
  const [showDeflectionResults, setShowDeflectionResults] = useState(true)
  const [undoStack, setUndoStack] = useState<ModelSnapshot[]>([])
  const [redoStack, setRedoStack] = useState<ModelSnapshot[]>([])

  const isHistoryNavigationRef = useRef(false)
  const previousSnapshotRef = useRef<ModelSnapshot>({ nodes, members })

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

    if (activeTool === 'drag') {
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

    if (activeTool === 'node' || activeTool === 'drag') {
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

  const handleSaveModelToFile = () => {
    const payload: PersistedTrussModel = {
      version: 1,
      nodes,
      members,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const downloadName = `truss-model-${timestamp}${MODEL_FILE_EXTENSION}`
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = blobUrl
    link.download = downloadName
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(blobUrl)
  }

  const handleLoadModelFromFile = async (file: File | null) => {
    if (!file) {
      return
    }

    const content = await file.text()
    const snapshot = parsePersistedModel(content)

    if (!snapshot) {
      window.alert('Could not load file. Please choose a valid truss model JSON file.')
      return
    }

    setNodes(snapshot.nodes)
    setMembers(snapshot.members)
    setMemberStartNodeId(null)
    setSelectedEntity(null)
  }

  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0

  const handleUndo = () => {
    if (!canUndo) {
      return
    }

    const previousSnapshot = undoStack[undoStack.length - 1]
    const currentSnapshot: ModelSnapshot = { nodes, members }
    isHistoryNavigationRef.current = true
    setNodes(previousSnapshot.nodes)
    setMembers(previousSnapshot.members)
    setUndoStack((currentUndoStack) => currentUndoStack.slice(0, -1))
    setRedoStack((currentRedoStack) => [currentSnapshot, ...currentRedoStack])
    setMemberStartNodeId(null)
    setSelectedEntity(null)
  }

  const handleRedo = () => {
    if (!canRedo) {
      return
    }

    const [nextSnapshot, ...remainingRedoSnapshots] = redoStack
    if (!nextSnapshot) {
      return
    }

    const currentSnapshot: ModelSnapshot = { nodes, members }
    isHistoryNavigationRef.current = true
    setNodes(nextSnapshot.nodes)
    setMembers(nextSnapshot.members)
    setRedoStack(remainingRedoSnapshots)
    setUndoStack((currentUndoStack) => [...currentUndoStack, currentSnapshot])
    setMemberStartNodeId(null)
    setSelectedEntity(null)
  }

  useEffect(() => {
    const previousSnapshot = previousSnapshotRef.current
    const hasModelChanged = previousSnapshot.nodes !== nodes || previousSnapshot.members !== members

    if (!hasModelChanged) {
      return
    }

    previousSnapshotRef.current = { nodes, members }

    if (isHistoryNavigationRef.current) {
      isHistoryNavigationRef.current = false
      return
    }

    setUndoStack((currentUndoStack) => {
      const nextUndoStack = [...currentUndoStack, previousSnapshot]
      if (nextUndoStack.length <= MAX_HISTORY_STEPS) {
        return nextUndoStack
      }

      return nextUndoStack.slice(nextUndoStack.length - MAX_HISTORY_STEPS)
    })
    setRedoStack([])
  }, [members, nodes])

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
    <main className="app-shell app-shell-canvas">
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
          showForceResults={showForceResults}
          showDeflectionResults={showDeflectionResults}
          onToggleShowForceResults={() =>
            setShowForceResults((currentShowForceResults) => !currentShowForceResults)
          }
          onToggleShowDeflectionResults={() =>
            setShowDeflectionResults((currentShowDeflectionResults) => !currentShowDeflectionResults)
          }
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSaveModel={handleSaveModelToFile}
          onLoadModel={handleLoadModelFromFile}
        />
    </main>
  )
}

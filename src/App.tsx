import { useEffect, useMemo } from 'react'
import { Editor2D } from './components/Editor2D'
import { PIXELS_PER_METER } from './constants'
import { useTrussEditorState } from './editor/useTrussEditorState'
import { analyzeTruss } from './lib/analysis'
import {
  createPersistedModel,
  MODEL_FILE_EXTENSION,
  parsePersistedModel,
} from './model/truss-persistence'

export default function App() {
  const { state, canUndo, canRedo, actions } = useTrussEditorState()
  const {
    nodes,
    members,
    memberStartNodeId,
    selectedEntity,
    selectedNodeIds,
    activeTool,
    showForceResults,
    showDeflectionResults,
  } = state

  const analysis = useMemo(() => analyzeTruss(nodes, members), [nodes, members])

  const displacementDisplayScale = useMemo(() => {
    if (analysis.maxDisplacementMeters <= 0) {
      return 0
    }

    const maxDisplacementPx = analysis.maxDisplacementMeters * PIXELS_PER_METER
    return maxDisplacementPx > 0 ? 24 / maxDisplacementPx : 0
  }, [analysis.maxDisplacementMeters])

  const canClearModel = nodes.length > 0 || members.length > 0

  const handleSaveModelToFile = () => {
    const blob = new Blob(
      [JSON.stringify(createPersistedModel({ nodes, members }), null, 2)],
      {
        type: 'application/json',
      },
    )
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

    actions.handleLoadModel(snapshot)
  }

  const handleClearModel = () => {
    if (!canClearModel) {
      return
    }

    const shouldClear = window.confirm('Clear all nodes, members, supports, and loads?')
    if (!shouldClear) {
      return
    }

    actions.handleClearModel()
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace' && event.key !== 'Escape') {
        return
      }

      const target = event.target as HTMLElement | null
      const tagName = target?.tagName ?? ''
      if (target?.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA') {
        return
      }

      if (event.key === 'Escape') {
        if (!memberStartNodeId) {
          return
        }

        event.preventDefault()
        actions.handleCancelMemberDrawing()
        return
      }

      if (!selectedEntity) {
        return
      }

      event.preventDefault()
      actions.handleDeleteSelection()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [actions, memberStartNodeId, selectedEntity])

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
        selectedNodeIds={selectedNodeIds}
        onCanvasClick={actions.handleCanvasClick}
        onNodeClick={actions.handleNodeClick}
        onMemberClick={actions.handleMemberClick}
        onMoveNode={actions.handleMoveNode}
        onSetActiveTool={actions.handleSetActiveTool}
        onSetSelectedNodeSupport={actions.handleSetSelectedNodeSupport}
        onSetSelectedMemberAxialStiffness={actions.handleSetSelectedMemberAxialStiffness}
        onSetSelectedNodeHorizontalLoad={actions.handleSetSelectedNodeHorizontalLoad}
        onSetSelectedNodeVerticalLoad={actions.handleSetSelectedNodeVerticalLoad}
        onDeleteNode={actions.handleDeleteNode}
        onDeleteMember={actions.handleDeleteMember}
        showForceResults={showForceResults}
        showDeflectionResults={showDeflectionResults}
        onToggleShowForceResults={actions.handleToggleShowForceResults}
        onToggleShowDeflectionResults={actions.handleToggleShowDeflectionResults}
        canUndo={canUndo}
        canRedo={canRedo}
        canClearModel={canClearModel}
        onUndo={actions.handleUndo}
        onRedo={actions.handleRedo}
        onSaveModel={handleSaveModelToFile}
        onLoadModel={handleLoadModelFromFile}
        onClearModel={handleClearModel}
      />
    </main>
  )
}

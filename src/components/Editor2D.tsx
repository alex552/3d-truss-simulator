import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { MouseEvent } from 'react'
import {
  EDITOR_HEIGHT,
  EDITOR_WIDTH,
  GRID_SIZE_PX,
  pixelsToMeters,
} from '../constants'
import { EditorInspector } from '../editor/EditorInspector'
import {
  DisplacedShapeOverlay,
  MemberForceLabel,
  NodeLoads,
  ReactionOverlay,
  SupportSymbol,
} from '../editor/EditorSvgAnnotations'
import { EditorToolbar } from '../editor/EditorToolbar'
import { getMajorGridStepMeters, ViewportGrid } from '../editor/ViewportGrid'
import type { EditorTool, PanSession, Point, SelectedEntity } from '../editor/types'
import { clampViewportZoom, useEditorViewport } from '../editor/useEditorViewport'
import { normalizeSupportType, type RuntimeSupportType } from '../lib/truss-model'
import type {
  HorizontalLoadDirection,
  Member,
  Node2D,
  SupportType,
  TrussAnalysisResult,
  VerticalLoadDirection,
} from '../types'

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
  showForceResults: boolean
  showDeflectionResults: boolean
  onToggleShowForceResults: () => void
  onToggleShowDeflectionResults: () => void
  canUndo: boolean
  canRedo: boolean
  canClearModel: boolean
  onUndo: () => void
  onRedo: () => void
  onSaveModel: () => void
  onLoadModel: (file: File | null) => void | Promise<void>
  onClearModel: () => void
}

const NODE_RADIUS = 8
const ZOOM_STEP = 1.2
const AUTO_PAN_EDGE_PX = 36
const AUTO_PAN_SPEED_PX = 16

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
  showForceResults,
  showDeflectionResults,
  onToggleShowForceResults,
  onToggleShowDeflectionResults,
  canUndo,
  canRedo,
  canClearModel,
  onUndo,
  onRedo,
  onSaveModel,
  onLoadModel,
  onClearModel,
}: Editor2DProps) {
  const [previewPoint, setPreviewPoint] = useState<Point | null>(null)
  const {
    viewport,
    viewportRef,
    updateViewport,
    updatePan,
    screenToWorld,
    snapWorldPoint,
    zoomAroundScreenPoint,
    resetViewport,
  } = useEditorViewport()
  const [canvasSize, setCanvasSize] = useState({
    width: EDITOR_WIDTH,
    height: EDITOR_HEIGHT,
  })
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [isResultsMenuOpen, setIsResultsMenuOpen] = useState(false)

  const canvasShellRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const canvasSizeRef = useRef(canvasSize)
  const lastCursorScreenPointRef = useRef<Point | null>(null)
  const dragNodeIdRef = useRef<string | null>(null)
  const dragMovedRef = useRef(false)
  const suppressClickRef = useRef(false)
  const panSessionRef = useRef<PanSession | null>(null)
  const isPanningRef = useRef(false)
  const spacePressedRef = useRef(false)
  const loadInputRef = useRef<HTMLInputElement | null>(null)

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

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])

  const selectedNodeSupport = normalizeSupportType(
    selectedNode?.support as RuntimeSupportType | undefined,
  )
  const selectedHorizontalLoad = selectedNode?.horizontalLoad
  const selectedVerticalLoad = selectedNode?.verticalLoad

  const isStableAnalysis =
    analysis.status === 'stable-determinate' || analysis.status === 'stable-indeterminate'
  const showAnyResults = showForceResults || showDeflectionResults
  const hasDrawnModel = nodes.length > 0 || members.length > 0

  const getScreenPointFromClient = (
    clientX: number,
    clientY: number,
    element: SVGSVGElement,
  ): Point => {
    const rect = element.getBoundingClientRect()
    const currentCanvasSize = canvasSizeRef.current
    const scaleX = currentCanvasSize.width / rect.width
    const scaleY = currentCanvasSize.height / rect.height

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  const setLastCursorScreenPoint = (screenPoint: Point) => {
    const currentCanvasSize = canvasSizeRef.current

    if (
      screenPoint.x < 0 ||
      screenPoint.y < 0 ||
      screenPoint.x > currentCanvasSize.width ||
      screenPoint.y > currentCanvasSize.height
    ) {
      return
    }

    lastCursorScreenPointRef.current = screenPoint
  }

  const getZoomAnchorScreenPoint = () =>
    lastCursorScreenPointRef.current ?? {
      x: canvasSizeRef.current.width / 2,
      y: canvasSizeRef.current.height / 2,
    }

  const getScreenPoint = (event: MouseEvent<SVGSVGElement>): Point =>
    getScreenPointFromClient(event.clientX, event.clientY, event.currentTarget)

  const getSnappedWorldPoint = (
    event: MouseEvent<SVGSVGElement>,
    nextViewport = viewportRef.current,
  ) => snapWorldPoint(screenToWorld(getScreenPoint(event), nextViewport))

  const fitViewportToModel = () => {
    if (nodes.length === 0) {
      resetViewport()
      return
    }

    const xs = nodes.map((node) => node.x)
    const ys = nodes.map((node) => node.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const padding = GRID_SIZE_PX * 3
    const contentWidth = Math.max(maxX - minX, GRID_SIZE_PX * 4)
    const contentHeight = Math.max(maxY - minY, GRID_SIZE_PX * 4)
    const nextZoom = clampViewportZoom(
      Math.min(
        canvasSize.width / (contentWidth + padding * 2),
        canvasSize.height / (contentHeight + padding * 2),
      ),
    )
    const visibleWidth = canvasSize.width / nextZoom
    const visibleHeight = canvasSize.height / nextZoom
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    updateViewport({
      zoom: nextZoom,
      panX: centerX - visibleWidth / 2,
      panY: centerY - visibleHeight / 2,
    })
  }

  const previewLengthInMeters =
    memberStartNode && previewPoint
      ? pixelsToMeters(
          Math.hypot(previewPoint.x - memberStartNode.x, previewPoint.y - memberStartNode.y),
        )
      : null
  const majorGridStepMeters = getMajorGridStepMeters(viewport.zoom)

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

  const horizontalMagnitudeChange = (value: string) => {
    const magnitudeKn = Number(value)
    onSetSelectedNodeHorizontalLoad(
      Number.isFinite(magnitudeKn) ? magnitudeKn : 0,
      selectedHorizontalLoad?.direction ?? 'right',
    )
  }

  const verticalMagnitudeChange = (value: string) => {
    const magnitudeKn = Number(value)
    onSetSelectedNodeVerticalLoad(
      Number.isFinite(magnitudeKn) ? magnitudeKn : 0,
      selectedVerticalLoad?.direction ?? 'down',
    )
  }

  const visibleWorldBounds = useMemo(
    () => ({
      minX: viewport.panX,
      maxX: viewport.panX + canvasSize.width / viewport.zoom,
      minY: viewport.panY,
      maxY: viewport.panY + canvasSize.height / viewport.zoom,
    }),
    [canvasSize.height, canvasSize.width, viewport.panX, viewport.panY, viewport.zoom],
  )

  useEffect(() => {
    canvasSizeRef.current = canvasSize
  }, [canvasSize])

  useEffect(() => {
    const canvasShell = canvasShellRef.current

    if (!canvasShell) {
      return
    }

    const updateCanvasSize = () => {
      const nextWidth = Math.max(1, Math.round(canvasShell.clientWidth))
      const nextHeight = Math.max(1, Math.round(canvasShell.clientHeight))
      const nextSize = { width: nextWidth, height: nextHeight }

      canvasSizeRef.current = nextSize

      setCanvasSize((currentSize) =>
        currentSize.width === nextWidth && currentSize.height === nextHeight
          ? currentSize
          : nextSize,
      )
    }

    updateCanvasSize()

    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize()
    })

    resizeObserver.observe(canvasShell)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  const sceneTransform = `matrix(${viewport.zoom} 0 0 ${viewport.zoom} ${-viewport.panX * viewport.zoom} ${-viewport.panY * viewport.zoom})`

  const handleLoadFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? [])
    await onLoadModel(file ?? null)
    event.target.value = ''
  }

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

  const shouldSuppressClick = () => {
    if (!suppressClickRef.current) {
      return false
    }

    suppressClickRef.current = false
    return true
  }

  const stopPanning = () => {
    if (!isPanningRef.current) {
      return
    }

    isPanningRef.current = false
    setIsPanning(false)
    panSessionRef.current = null
  }

  const handleCanvasMouseDown = (event: MouseEvent<SVGSVGElement>) => {
    setLastCursorScreenPoint(getScreenPoint(event))

    const isPanGesture =
      event.button === 1 ||
      (spacePressedRef.current && event.button === 0) ||
      (activeTool === 'drag' && event.button === 0)

    if (!isPanGesture) {
      return
    }

    event.preventDefault()
    suppressClickRef.current = true
    dragNodeIdRef.current = null
    dragMovedRef.current = false
    isPanningRef.current = true
    setIsPanning(true)
    panSessionRef.current = {
      startScreenPoint: getScreenPoint(event),
      startPanX: viewportRef.current.panX,
      startPanY: viewportRef.current.panY,
    }
  }

  const handleCanvasClick = (event: MouseEvent<SVGSVGElement>) => {
    setLastCursorScreenPoint(getScreenPoint(event))

    if (shouldSuppressClick()) {
      return
    }

    if (dragMovedRef.current) {
      dragMovedRef.current = false
      return
    }

    const point = getSnappedWorldPoint(event)
    onCanvasClick(point.x, point.y)
    setPreviewPoint(point)
  }

  const handleMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    const screenPoint = getScreenPoint(event)
    setLastCursorScreenPoint(screenPoint)

    if (isPanningRef.current && panSessionRef.current) {
      const currentZoom = viewportRef.current.zoom
      updatePan(
        panSessionRef.current.startPanX -
          (screenPoint.x - panSessionRef.current.startScreenPoint.x) / currentZoom,
        panSessionRef.current.startPanY -
          (screenPoint.y - panSessionRef.current.startScreenPoint.y) / currentZoom,
      )
      return
    }

    let nextViewport = viewportRef.current

    if (dragNodeIdRef.current) {
      const autoPanDelta = getAutoPanDelta(screenPoint, nextViewport.zoom)

      if (autoPanDelta.x !== 0 || autoPanDelta.y !== 0) {
        nextViewport = {
          ...nextViewport,
          panX: nextViewport.panX + autoPanDelta.x,
          panY: nextViewport.panY + autoPanDelta.y,
        }
        updateViewport(nextViewport)
      }
    }

    const point = snapWorldPoint(screenToWorld(screenPoint, nextViewport))

    if (dragNodeIdRef.current) {
      dragMovedRef.current = true
      onMoveNode(dragNodeIdRef.current, point.x, point.y)
      return
    }

    if (activeTool === 'member' && memberStartNode) {
      setPreviewPoint(point)
    }
  }

  const handleMouseUp = () => {
    if (dragMovedRef.current || isPanningRef.current) {
      suppressClickRef.current = true
    }

    dragNodeIdRef.current = null
    stopPanning()
  }

  useEffect(() => {
    const svgElement = svgRef.current

    if (!svgElement) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()

      const zoomFactor = Math.exp(-event.deltaY * 0.0015)
      const screenPoint = getScreenPointFromClient(event.clientX, event.clientY, svgElement)

      setLastCursorScreenPoint(screenPoint)
      zoomAroundScreenPoint(viewportRef.current.zoom * zoomFactor, screenPoint)
    }

    svgElement.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      svgElement.removeEventListener('wheel', handleWheel)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName ?? ''
      const isEditable =
        target?.isContentEditable ||
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'BUTTON' ||
        tagName === 'SELECT'

      if (isEditable || event.code !== 'Space') {
        return
      }

      event.preventDefault()

      if (!spacePressedRef.current) {
        spacePressedRef.current = true
        setIsSpacePressed(true)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return
      }

      spacePressedRef.current = false
      setIsSpacePressed(false)
      stopPanning()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return (
    <div className="editor-fullscreen">
      <input
        ref={loadInputRef}
        type="file"
        accept="application/json,.json,.truss.json"
        style={{ display: 'none' }}
        onChange={handleLoadFileInputChange}
      />
      <div ref={canvasShellRef} className="editor-canvas-shell editor-canvas-shell-fullscreen">
        <EditorToolbar
          activeTool={activeTool}
          showAnyResults={showAnyResults}
          showForceResults={showForceResults}
          showDeflectionResults={showDeflectionResults}
          isResultsMenuOpen={isResultsMenuOpen}
          canUndo={canUndo}
          canRedo={canRedo}
          canClearModel={canClearModel}
          onSetActiveTool={onSetActiveTool}
          onSetResultsMenuOpen={setIsResultsMenuOpen}
          onToggleShowForceResults={onToggleShowForceResults}
          onToggleShowDeflectionResults={onToggleShowDeflectionResults}
          onUndo={onUndo}
          onRedo={onRedo}
          onSaveModel={onSaveModel}
          onRequestLoadModel={() => loadInputRef.current?.click()}
          onClearModel={onClearModel}
          viewportScaleLabel={formatGridStepLabel(majorGridStepMeters)}
          onZoomOut={() =>
            zoomAroundScreenPoint(viewportRef.current.zoom / ZOOM_STEP, getZoomAnchorScreenPoint())
          }
          onZoomIn={() =>
            zoomAroundScreenPoint(viewportRef.current.zoom * ZOOM_STEP, getZoomAnchorScreenPoint())
          }
          onFitViewport={fitViewportToModel}
          onResetViewport={resetViewport}
        />

        {hasDrawnModel ? (
          <div
            className={`editor-overlay editor-structure-status editor-stability-status editor-stability-status-${analysis.status}`}
            aria-live="polite"
          >
            <span className="editor-structure-status-label">Current structure</span>
            <strong className="editor-structure-status-value">
              {formatStabilityValue(analysis.status)}
            </strong>
            <span className="editor-structure-status-meta">
              {formatStabilityMeta(analysis.status)}
            </span>
          </div>
        ) : null}

        <EditorInspector
          selectedNode={selectedNode}
          selectedMember={selectedMember}
          selectedNodeSupport={selectedNodeSupport}
          selectedHorizontalLoad={selectedHorizontalLoad}
          selectedVerticalLoad={selectedVerticalLoad}
          onSetSelectedNodeSupport={onSetSelectedNodeSupport}
          onSetSelectedMemberAxialStiffness={onSetSelectedMemberAxialStiffness}
          onSetSelectedNodeHorizontalLoad={onSetSelectedNodeHorizontalLoad}
          onSetSelectedNodeVerticalLoad={onSetSelectedNodeVerticalLoad}
          onHorizontalMagnitudeChange={horizontalMagnitudeChange}
          onVerticalMagnitudeChange={verticalMagnitudeChange}
        />

        <svg
          ref={svgRef}
          className={`editor-surface${
            isPanning ? ' is-panning' : isSpacePressed || activeTool === 'drag' ? ' is-pan-ready' : ''
          }`}
          viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
          onMouseDown={handleCanvasMouseDown}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          role="img"
          aria-label="2D truss editor"
        >
            <rect
              x="0"
              y="0"
              width={canvasSize.width}
              height={canvasSize.height}
              className="editor-grid-background"
            />
            <ViewportGrid
              width={canvasSize.width}
              height={canvasSize.height}
              minX={visibleWorldBounds.minX}
              maxX={visibleWorldBounds.maxX}
              minY={visibleWorldBounds.minY}
              maxY={visibleWorldBounds.maxY}
              zoom={viewport.zoom}
              panX={viewport.panX}
              panY={viewport.panY}
            />

            <g transform={sceneTransform}>
              {members.map((member) => {
                const nodeA = nodeById.get(member.nodeAId)
                const nodeB = nodeById.get(member.nodeBId)

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
                        if (shouldSuppressClick()) {
                          event.stopPropagation()
                          return
                        }

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
                    {showForceResults && isStableAnalysis ? (
                      <MemberForceLabel
                        midX={midX}
                        midY={midY}
                        result={memberResultByMemberId.get(member.id)}
                      />
                    ) : null}
                  </g>
                )
              })}

              {showDeflectionResults && isStableAnalysis && displacementDisplayScale > 0 ? (
                <DisplacedShapeOverlay
                  nodes={nodes}
                  members={members}
                  displacementByNodeId={displacementByNodeId}
                  memberResultByMemberId={memberResultByMemberId}
                  displayScale={displacementDisplayScale}
                />
              ) : null}

              {memberStartNode &&
              isPreviewVisible &&
              previewPoint &&
              previewMidpoint &&
              previewLengthInMeters ? (
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
                  {showForceResults && isStableAnalysis ? (
                    <ReactionOverlay node={node} reaction={reactionByNodeId.get(node.id)} />
                  ) : null}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={NODE_RADIUS}
                    className={getNodeClassName(node.id)}
                    onMouseDown={(event) => {
                      if (event.button === 1 || (spacePressedRef.current && event.button === 0)) {
                        return
                      }

                      if (activeTool !== 'select') {
                        return
                      }

                      event.preventDefault()
                      event.stopPropagation()
                      onNodeClick(node.id)
                      dragNodeIdRef.current = node.id
                      dragMovedRef.current = false
                    }}
                    onClick={(event) => {
                      if (shouldSuppressClick()) {
                        event.stopPropagation()
                        return
                      }

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
            </g>
        </svg>
      </div>
    </div>
  )
}

function formatGridStepLabel(valueMeters: number) {
  return `${Number(valueMeters.toFixed(2))} m`
}

function formatStabilityValue(status: TrussAnalysisResult['status']) {
  return status === 'stable-determinate' || status === 'stable-indeterminate'
    ? 'Stable'
    : status === 'unstable'
      ? 'Unstable'
      : 'Invalid'
}

function formatStabilityMeta(status: TrussAnalysisResult['status']) {
  if (status === 'stable-determinate') {
    return 'Stiffness analysis: determinate'
  }

  if (status === 'stable-indeterminate') {
    return 'Stiffness analysis: indeterminate'
  }

  return status === 'unstable'
    ? 'Stiffness analysis: mechanism'
    : 'Stiffness analysis: check model'
}

function getAutoPanDelta(screenPoint: Point, zoom: number) {
  let screenDx = 0
  let screenDy = 0

  if (screenPoint.x < AUTO_PAN_EDGE_PX) {
    screenDx = -Math.min(AUTO_PAN_SPEED_PX, AUTO_PAN_EDGE_PX - screenPoint.x)
  } else if (screenPoint.x > EDITOR_WIDTH - AUTO_PAN_EDGE_PX) {
    screenDx = Math.min(AUTO_PAN_SPEED_PX, screenPoint.x - (EDITOR_WIDTH - AUTO_PAN_EDGE_PX))
  }

  if (screenPoint.y < AUTO_PAN_EDGE_PX) {
    screenDy = -Math.min(AUTO_PAN_SPEED_PX, AUTO_PAN_EDGE_PX - screenPoint.y)
  } else if (screenPoint.y > EDITOR_HEIGHT - AUTO_PAN_EDGE_PX) {
    screenDy = Math.min(AUTO_PAN_SPEED_PX, screenPoint.y - (EDITOR_HEIGHT - AUTO_PAN_EDGE_PX))
  }

  return {
    x: screenDx / zoom,
    y: screenDy / zoom,
  }
}

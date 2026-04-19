import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { MouseEvent } from 'react'
import {
  EDITOR_HEIGHT,
  EDITOR_WIDTH,
  GRID_SIZE_PX,
  PIXELS_PER_METER,
  pixelsToMeters,
  snapToGrid,
} from '../constants'
import { normalizeSupportType, type RuntimeSupportType } from '../lib/truss-model'
import type {
  HorizontalLoadDirection,
  Member,
  MemberAnalysisResult,
  Node2D,
  NodeDisplacement,
  NodeReaction,
  SupportType,
  TrussAnalysisResult,
  VerticalLoadDirection,
} from '../types'
import type { EditorTool, SelectedEntity } from '../App'

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
}

type Point = {
  x: number
  y: number
}

type Viewport = {
  zoom: number
  panX: number
  panY: number
}

type PanSession = {
  startScreenPoint: Point
  startPanX: number
  startPanY: number
}

const NODE_RADIUS = 8
const AXIS_MARGIN = 28
const MIN_ZOOM = 0.35
const MAX_ZOOM = 3.5
const ZOOM_STEP = 1.2
const AUTO_PAN_EDGE_PX = 36
const AUTO_PAN_SPEED_PX = 16
const TOOL_OPTIONS: { value: EditorTool; label: string; title: string }[] = [
  { value: 'select', label: 'Select tool', title: 'Select' },
  { value: 'drag', label: 'Drag view tool', title: 'Drag view' },
  { value: 'node', label: 'Node tool', title: 'Place node' },
  { value: 'member', label: 'Member tool', title: 'Draw member' },
]
const SUPPORT_OPTIONS: { value: SupportType | undefined; label: string; title: string }[] = [
  { value: undefined, label: 'No support', title: 'None' },
  { value: 'pinned', label: 'Pinned support', title: 'Pinned' },
  { value: 'roller-x', label: 'Roller X support', title: 'Roller X' },
  { value: 'roller-z', label: 'Roller Z support', title: 'Roller Z' },
]

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
}: Editor2DProps) {
  const [previewPoint, setPreviewPoint] = useState<Point | null>(null)
  const [viewport, setViewportState] = useState<Viewport>({
    zoom: 1,
    panX: 0,
    panY: 0,
  })
  const [canvasSize, setCanvasSize] = useState({
    width: EDITOR_WIDTH,
    height: EDITOR_HEIGHT,
  })
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)

  const viewportRef = useRef(viewport)
  const canvasShellRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragNodeIdRef = useRef<string | null>(null)
  const dragMovedRef = useRef(false)
  const suppressClickRef = useRef(false)
  const panSessionRef = useRef<PanSession | null>(null)
  const isPanningRef = useRef(false)
  const spacePressedRef = useRef(false)

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

  const horizontalDirectionOptions: HorizontalLoadDirection[] = ['left', 'right']
  const verticalDirectionOptions: VerticalLoadDirection[] = ['up', 'down']
  const isStableAnalysis =
    analysis.status === 'stable-determinate' || analysis.status === 'stable-indeterminate'

  const updateViewport = (nextViewport: Viewport) => {
    viewportRef.current = nextViewport
    setViewportState(nextViewport)
  }

  const updatePan = (panX: number, panY: number) => {
    updateViewport({ ...viewportRef.current, panX, panY })
  }

  const getScreenPointFromClient = (
    clientX: number,
    clientY: number,
    element: SVGSVGElement,
  ): Point => {
    const rect = element.getBoundingClientRect()
    const scaleX = canvasSize.width / rect.width
    const scaleY = canvasSize.height / rect.height

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  const getScreenPoint = (event: MouseEvent<SVGSVGElement>): Point =>
    getScreenPointFromClient(event.clientX, event.clientY, event.currentTarget)

  const screenToWorld = (screenPoint: Point, nextViewport = viewportRef.current): Point => ({
    x: nextViewport.panX + screenPoint.x / nextViewport.zoom,
    y: nextViewport.panY + screenPoint.y / nextViewport.zoom,
  })

  const snapWorldPoint = (worldPoint: Point): Point => ({
    x: snapToGrid(worldPoint.x),
    y: snapToGrid(worldPoint.y),
  })

  const getSnappedWorldPoint = (
    event: MouseEvent<SVGSVGElement>,
    nextViewport = viewportRef.current,
  ) => snapWorldPoint(screenToWorld(getScreenPoint(event), nextViewport))

  const zoomAroundScreenPoint = (targetZoom: number, screenPoint: Point) => {
    const nextZoom = clampZoom(targetZoom)
    const currentViewport = viewportRef.current

    if (Math.abs(nextZoom - currentViewport.zoom) < 1e-6) {
      return
    }

    const anchorWorld = screenToWorld(screenPoint, currentViewport)
    updateViewport({
      zoom: nextZoom,
      panX: anchorWorld.x - screenPoint.x / nextZoom,
      panY: anchorWorld.y - screenPoint.y / nextZoom,
    })
  }

  const resetViewport = () => {
    updateViewport({
      zoom: 1,
      panX: 0,
      panY: 0,
    })
  }

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
    const nextZoom = clampZoom(
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
    const canvasShell = canvasShellRef.current

    if (!canvasShell) {
      return
    }

    const updateCanvasSize = () => {
      const nextWidth = Math.max(1, Math.round(canvasShell.clientWidth))
      const nextHeight = Math.max(1, Math.round(canvasShell.clientHeight))

      setCanvasSize((currentSize) =>
        currentSize.width === nextWidth && currentSize.height === nextHeight
          ? currentSize
          : { width: nextWidth, height: nextHeight },
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
      zoomAroundScreenPoint(
        viewportRef.current.zoom * zoomFactor,
        getScreenPointFromClient(event.clientX, event.clientY, svgElement),
      )
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
      <div ref={canvasShellRef} className="editor-canvas-shell editor-canvas-shell-fullscreen">
          <div className="editor-overlay editor-tool-rail" aria-label="2D editor toolbar">
            {TOOL_OPTIONS.map((tool) => (
              <button
                key={tool.value}
                type="button"
                className={
                  activeTool === tool.value
                    ? 'tool-button cad-tool-button is-active'
                    : 'tool-button cad-tool-button'
                }
                onClick={() => onSetActiveTool(tool.value)}
                aria-label={tool.label}
                title={tool.title}
              >
                <ToolIcon tool={tool.value} />
              </button>
            ))}
          </div>

          {selectedNode ? (
            <div className="editor-overlay editor-inspector" aria-label="Selected node properties">
              <div className="inspector-header">
                <span className="inspector-eyebrow">Node</span>
                <span className="inspector-title">Selected node</span>
              </div>

              <div className="node-properties">
                <div className="inspector-section" aria-label="Selected node supports">
                  <span className="inspector-label">Support</span>
                  <div className="support-chip-group">
                    {SUPPORT_OPTIONS.map((option) => (
                      <button
                        key={option.title}
                        type="button"
                        className={
                          selectedNodeSupport === option.value ||
                          (selectedNodeSupport === undefined && option.value === undefined)
                            ? 'tool-button support-chip is-active'
                            : 'tool-button support-chip'
                        }
                        onClick={() => onSetSelectedNodeSupport(option.value)}
                        aria-label={option.label}
                        title={option.title}
                      >
                        <SupportChipIcon support={option.value} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="load-editor-group" aria-label="Node loads">
                  <div className="load-editor">
                    <span className="load-label">H</span>
                    <div className="direction-toggle">
                      {horizontalDirectionOptions.map((direction) => (
                        <button
                          key={direction}
                          type="button"
                          className={
                            (selectedHorizontalLoad?.direction ?? 'right') === direction
                              ? 'tool-button direction-button is-active'
                              : 'tool-button direction-button'
                          }
                          onClick={() =>
                            onSetSelectedNodeHorizontalLoad(
                              selectedHorizontalLoad?.magnitudeKn ?? 0,
                              direction,
                            )
                          }
                          aria-label={`Horizontal load ${direction}`}
                          title={`Horizontal ${direction}`}
                        >
                          {direction === 'left' ? '←' : '→'}
                        </button>
                      ))}
                    </div>
                    <input
                      className="load-input"
                      type="number"
                      min="0"
                      step="0.1"
                      value={selectedHorizontalLoad?.magnitudeKn ?? 0}
                      onChange={(event) => horizontalMagnitudeChange(event.target.value)}
                    />
                    <span className="load-unit">kN</span>
                  </div>

                  <div className="load-editor">
                    <span className="load-label">V</span>
                    <div className="direction-toggle">
                      {verticalDirectionOptions.map((direction) => (
                        <button
                          key={direction}
                          type="button"
                          className={
                            (selectedVerticalLoad?.direction ?? 'down') === direction
                              ? 'tool-button direction-button is-active'
                              : 'tool-button direction-button'
                          }
                          onClick={() =>
                            onSetSelectedNodeVerticalLoad(
                              selectedVerticalLoad?.magnitudeKn ?? 0,
                              direction,
                            )
                          }
                          aria-label={`Vertical load ${direction}`}
                          title={`Vertical ${direction}`}
                        >
                          {direction === 'up' ? '↑' : '↓'}
                        </button>
                      ))}
                    </div>
                    <input
                      className="load-input"
                      type="number"
                      min="0"
                      step="0.1"
                      value={selectedVerticalLoad?.magnitudeKn ?? 0}
                      onChange={(event) => verticalMagnitudeChange(event.target.value)}
                    />
                    <span className="load-unit">kN</span>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedMember ? (
            <div className="editor-overlay editor-inspector" aria-label="Selected member properties">
              <div className="inspector-header">
                <span className="inspector-eyebrow">Member</span>
                <span className="inspector-title">Selected member</span>
              </div>

              <div className="member-properties">
                <div className="load-editor">
                  <span className="load-label">EA</span>
                  <input
                    className="load-input member-stiffness-input"
                    type="number"
                    min="1"
                    step="1000"
                    value={selectedMember.axialStiffnessKn}
                    onChange={(event) =>
                      onSetSelectedMemberAxialStiffness(
                        Math.max(1, Number(event.target.value) || selectedMember.axialStiffnessKn),
                      )
                    }
                  />
                  <span className="load-unit">kN</span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="editor-overlay editor-axis-overlay" aria-hidden="true">
            <svg viewBox="0 0 124 56" className="editor-axis-diagram">
              <line x1="18" y1="38" x2="88" y2="38" className="axis-line axis-line-x" />
              <polygon points="96,38 84,33 84,43" className="axis-arrow-x" />
              <line x1="18" y1="38" x2="18" y2="10" className="axis-line axis-line-z" />
              <polygon points="18,2 13,14 23,14" className="axis-arrow-z" />
              <text x="102" y="42" className="axis-label axis-label-x">
                X
              </text>
              <text x="12" y="11" className="axis-label axis-label-z">
                Z
              </text>
            </svg>
            <span className="editor-axis-hint">Y axis points out of the screen. Snap: 0.1 m</span>
          </div>

          <div className="editor-overlay editor-viewport-hud" aria-label="Viewport controls">
            <button
              type="button"
              className="tool-button viewport-button"
              onClick={() =>
                zoomAroundScreenPoint(viewport.zoom / ZOOM_STEP, {
                  x: canvasSize.width / 2,
                  y: canvasSize.height / 2,
                })
              }
              aria-label="Zoom out"
              title="Zoom out"
            >
              −
            </button>
            <span className="viewport-zoom-readout">{Math.round(viewport.zoom * 100)}%</span>
            <button
              type="button"
              className="tool-button viewport-button"
              onClick={() =>
                zoomAroundScreenPoint(viewport.zoom * ZOOM_STEP, {
                  x: canvasSize.width / 2,
                  y: canvasSize.height / 2,
                })
              }
              aria-label="Zoom in"
              title="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="tool-button viewport-fit-button"
              onClick={fitViewportToModel}
            >
              Fit
            </button>
            <button
              type="button"
              className="tool-button viewport-fit-button"
              onClick={resetViewport}
            >
              1:1
            </button>
          </div>

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
                    {isStableAnalysis ? (
                      <MemberForceLabel
                        midX={midX}
                        midY={midY}
                        result={memberResultByMemberId.get(member.id)}
                      />
                    ) : null}
                  </g>
                )
              })}

              {isStableAnalysis && displacementDisplayScale > 0 ? (
                <DisplacedShapeOverlay
                  nodes={nodes}
                  members={members}
                  displacementByNodeId={displacementByNodeId}
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
                  {isStableAnalysis ? (
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

function ViewportGrid({
  width,
  height,
  minX,
  maxX,
  minY,
  maxY,
  zoom,
  panX,
  panY,
}: {
  width: number
  height: number
  minX: number
  maxX: number
  minY: number
  maxY: number
  zoom: number
  panX: number
  panY: number
}) {
  const gridLines: ReactElement[] = []
  const showMinorLines = GRID_SIZE_PX * zoom >= 10
  let majorMultiple = 5

  while (GRID_SIZE_PX * majorMultiple * zoom < 56) {
    majorMultiple *= 2
  }

  const majorStep = GRID_SIZE_PX * majorMultiple

  if (showMinorLines) {
    for (
      let x = Math.floor(minX / GRID_SIZE_PX) * GRID_SIZE_PX;
      x <= maxX + GRID_SIZE_PX;
      x += GRID_SIZE_PX
    ) {
      if (Math.abs(x / majorStep - Math.round(x / majorStep)) < 0.001) {
        continue
      }

      gridLines.push(
        <line
          key={`minor-x-${x}`}
          x1={(x - panX) * zoom}
          y1={0}
          x2={(x - panX) * zoom}
          y2={height}
          className="editor-grid-line editor-grid-line-minor"
        />,
      )
    }

    for (
      let y = Math.floor(minY / GRID_SIZE_PX) * GRID_SIZE_PX;
      y <= maxY + GRID_SIZE_PX;
      y += GRID_SIZE_PX
    ) {
      if (Math.abs(y / majorStep - Math.round(y / majorStep)) < 0.001) {
        continue
      }

      gridLines.push(
        <line
          key={`minor-y-${y}`}
          x1={0}
          y1={(y - panY) * zoom}
          x2={width}
          y2={(y - panY) * zoom}
          className="editor-grid-line editor-grid-line-minor"
        />,
      )
    }
  }

  for (
    let x = Math.floor(minX / majorStep) * majorStep;
    x <= maxX + majorStep;
    x += majorStep
  ) {
    gridLines.push(
      <line
        key={`major-x-${x}`}
        x1={(x - panX) * zoom}
        y1={0}
        x2={(x - panX) * zoom}
        y2={height}
        className="editor-grid-line editor-grid-line-major"
      />,
    )
  }

  for (
    let y = Math.floor(minY / majorStep) * majorStep;
    y <= maxY + majorStep;
    y += majorStep
  ) {
    gridLines.push(
      <line
        key={`major-y-${y}`}
        x1={0}
        y1={(y - panY) * zoom}
        x2={width}
        y2={(y - panY) * zoom}
        className="editor-grid-line editor-grid-line-major"
      />,
    )
  }

  return <g pointerEvents="none">{gridLines}</g>
}

function ToolIcon({ tool }: { tool: EditorTool }) {
  if (tool === 'select') {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
        <path d="M6 4 L16 14 L11.2 14.2 L13.4 20 L10.5 21 L8.4 15.1 L5 18 Z" />
      </svg>
    )
  }

  if (tool === 'drag') {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
        <path d="M12 3 V11" />
        <path d="M8.5 6.5 L12 3 L15.5 6.5" />
        <path d="M12 11 V19" />
        <path d="M8.5 17.5 L12 21 L15.5 17.5" />
        <path d="M5 12 H13" />
        <path d="M8.5 8.5 L5 12 L8.5 15.5" />
        <path d="M13 12 H21" />
        <path d="M17.5 8.5 L21 12 L17.5 15.5" />
      </svg>
    )
  }

  if (tool === 'node') {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 4 V7.5 M12 16.5 V20 M4 12 H7.5 M16.5 12 H20" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
      <circle cx="7" cy="16" r="2.3" />
      <circle cx="17" cy="8" r="2.3" />
      <path d="M8.8 14.4 L15.2 9.6" />
    </svg>
  )
}

function SupportChipIcon({ support }: { support: SupportType | undefined }) {
  if (!support) {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon support-icon" aria-hidden="true">
        <path d="M6 6 L18 18 M18 6 L6 18" />
      </svg>
    )
  }

  if (support === 'pinned') {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon support-icon" aria-hidden="true">
        <path d="M12 4 V8" />
        <path d="M12 8 L6 16 H18 Z" />
        <path d="M6 18 H18" />
      </svg>
    )
  }

  if (support === 'roller-x') {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon support-icon" aria-hidden="true">
        <path d="M12 3 V7" />
        <path d="M12 7 L6 13 H18 Z" />
        <circle cx="9" cy="16.5" r="1.8" />
        <circle cx="15" cy="16.5" r="1.8" />
        <path d="M6 20 H18" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="tool-icon support-icon" aria-hidden="true">
      <path d="M3 12 H7" />
      <path d="M7 12 L13 6 V18 Z" />
      <circle cx="16.5" cy="9" r="1.8" />
      <circle cx="16.5" cy="15" r="1.8" />
      <path d="M20 6 V18" />
    </svg>
  )
}

function SupportSymbol({ node }: { node: Node2D }) {
  const support = normalizeSupportType(node.support as RuntimeSupportType | undefined)

  if (!support) {
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

  if (support === 'pinned') {
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

  if (support === 'roller-x') {
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

function NodeLoads({ node }: { node: Node2D }) {
  const loadElements: ReactElement[] = []

  if (node.horizontalLoad) {
    const arrowLength = clampArrowLength(node.horizontalLoad.magnitudeKn)
    const direction = node.horizontalLoad.direction === 'left' ? -1 : 1
    const endX = node.x + direction * arrowLength
    const offsetY = node.verticalLoad ? node.y - 34 : node.y - 26

    loadElements.push(
      <g key="horizontal-load" className="node-load" pointerEvents="none">
        <line x1={node.x} y1={offsetY} x2={endX} y2={offsetY} className="load-arrow-line" />
        <polygon
          points={
            direction === 1
              ? `${endX},${offsetY} ${endX - 10},${offsetY - 5} ${endX - 10},${offsetY + 5}`
              : `${endX},${offsetY} ${endX + 10},${offsetY - 5} ${endX + 10},${offsetY + 5}`
          }
          className="load-arrow-head"
        />
        <text
          x={(node.x + endX) / 2}
          y={offsetY - 8}
          className="load-label-text"
          textAnchor="middle"
        >
          {node.horizontalLoad.magnitudeKn.toFixed(1)} kN
        </text>
      </g>,
    )
  }

  if (node.verticalLoad) {
    const arrowLength = clampArrowLength(node.verticalLoad.magnitudeKn)
    const direction = node.verticalLoad.direction === 'up' ? -1 : 1
    const endY = node.y + direction * arrowLength
    const offsetX = node.horizontalLoad ? node.x + 34 : node.x + 26

    loadElements.push(
      <g key="vertical-load" className="node-load" pointerEvents="none">
        <line x1={offsetX} y1={node.y} x2={offsetX} y2={endY} className="load-arrow-line" />
        <polygon
          points={
            direction === 1
              ? `${offsetX},${endY} ${offsetX - 5},${endY - 10} ${offsetX + 5},${endY - 10}`
              : `${offsetX},${endY} ${offsetX - 5},${endY + 10} ${offsetX + 5},${endY + 10}`
          }
          className="load-arrow-head"
        />
        <text x={offsetX + 10} y={(node.y + endY) / 2 - 6} className="load-label-text">
          {node.verticalLoad.magnitudeKn.toFixed(1)} kN
        </text>
      </g>,
    )
  }

  return <>{loadElements}</>
}

function clampArrowLength(magnitudeKn: number) {
  return Math.min(72, Math.max(28, 20 + magnitudeKn * 4))
}

function DisplacedShapeOverlay({
  nodes,
  members,
  displacementByNodeId,
  displayScale,
}: {
  nodes: Node2D[]
  members: Member[]
  displacementByNodeId: Map<string, NodeDisplacement>
  displayScale: number
}) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  return (
    <g pointerEvents="none">
      {members.map((member) => {
        const startNode = nodeById.get(member.nodeAId)
        const endNode = nodeById.get(member.nodeBId)

        if (!startNode || !endNode) {
          return null
        }

        const displacedStart = getDisplacedNodePosition(
          startNode,
          displacementByNodeId.get(startNode.id),
          displayScale,
        )
        const displacedEnd = getDisplacedNodePosition(
          endNode,
          displacementByNodeId.get(endNode.id),
          displayScale,
        )

        return (
          <line
            key={member.id}
            x1={displacedStart.x}
            y1={displacedStart.y}
            x2={displacedEnd.x}
            y2={displacedEnd.y}
            className="displaced-member-line"
          />
        )
      })}
    </g>
  )
}

function MemberForceLabel({
  midX,
  midY,
  result,
}: {
  midX: number
  midY: number
  result: MemberAnalysisResult | undefined
}) {
  if (!result) {
    return null
  }

  return (
    <text
      x={midX}
      y={midY + 16}
      className={`member-force-label member-force-label-${result.state}`}
      textAnchor="middle"
    >
      {formatSignedKn(result.axialForceKn)}
    </text>
  )
}

function ReactionOverlay({
  node,
  reaction,
}: {
  node: Node2D
  reaction: NodeReaction | undefined
}) {
  if (!reaction) {
    return null
  }

  return (
    <>
      {Math.abs(reaction.xKn) > 1e-6 ? (
        <DirectionalResultArrow
          startX={node.x}
          startY={node.y - 18}
          dx={
            reaction.xKn > 0
              ? clampArrowLength(Math.abs(reaction.xKn))
              : -clampArrowLength(Math.abs(reaction.xKn))
          }
          dy={0}
          label={formatSignedKn(reaction.xKn)}
          labelDx={0}
          labelDy={-8}
        />
      ) : null}
      {Math.abs(reaction.zKn) > 1e-6 ? (
        <DirectionalResultArrow
          startX={node.x + 18}
          startY={node.y}
          dx={0}
          dy={
            reaction.zKn > 0
              ? -clampArrowLength(Math.abs(reaction.zKn))
              : clampArrowLength(Math.abs(reaction.zKn))
          }
          label={formatSignedKn(reaction.zKn)}
          labelDx={10}
          labelDy={-4}
        />
      ) : null}
    </>
  )
}

function DirectionalResultArrow({
  startX,
  startY,
  dx,
  dy,
  label,
  labelDx,
  labelDy,
}: {
  startX: number
  startY: number
  dx: number
  dy: number
  label: string
  labelDx: number
  labelDy: number
}) {
  const endX = startX + dx
  const endY = startY + dy

  return (
    <g className="reaction-overlay" pointerEvents="none">
      <line x1={startX} y1={startY} x2={endX} y2={endY} className="reaction-arrow-line" />
      <polygon points={getArrowHeadPoints(endX, endY, dx, dy)} className="reaction-arrow-head" />
      <text
        x={(startX + endX) / 2 + labelDx}
        y={(startY + endY) / 2 + labelDy}
        className="reaction-label-text"
      >
        {label}
      </text>
    </g>
  )
}

function getDisplacedNodePosition(
  node: Node2D,
  displacement: NodeDisplacement | undefined,
  displayScale: number,
) {
  return {
    x: node.x + (displacement?.xMeters ?? 0) * PIXELS_PER_METER * displayScale,
    y: node.y - (displacement?.zMeters ?? 0) * PIXELS_PER_METER * displayScale,
  }
}

function getArrowHeadPoints(endX: number, endY: number, dx: number, dy: number) {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0
      ? `${endX},${endY} ${endX - 10},${endY - 5} ${endX - 10},${endY + 5}`
      : `${endX},${endY} ${endX + 10},${endY - 5} ${endX + 10},${endY + 5}`
  }

  return dy >= 0
    ? `${endX},${endY} ${endX - 5},${endY - 10} ${endX + 5},${endY - 10}`
    : `${endX},${endY} ${endX - 5},${endY + 10} ${endX + 5},${endY + 10}`
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
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

function formatSignedKn(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)} kN`
}

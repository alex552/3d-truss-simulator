import { useRef, useState } from 'react'
import { snapToGrid } from '../constants'
import type { Point, Viewport } from './types'

const MIN_ZOOM = 0.08
const MAX_ZOOM = 12

export function useEditorViewport() {
  const [viewport, setViewportState] = useState<Viewport>({
    zoom: 1,
    panX: 0,
    panY: 0,
  })
  const viewportRef = useRef(viewport)

  const updateViewport = (nextViewport: Viewport) => {
    viewportRef.current = nextViewport
    setViewportState(nextViewport)
  }

  const updatePan = (panX: number, panY: number) => {
    updateViewport({ ...viewportRef.current, panX, panY })
  }

  const screenToWorld = (
    screenPoint: Point,
    nextViewport = viewportRef.current,
  ): Point => ({
    x: nextViewport.panX + screenPoint.x / nextViewport.zoom,
    y: nextViewport.panY + screenPoint.y / nextViewport.zoom,
  })

  const snapWorldPoint = (worldPoint: Point): Point => ({
    x: snapToGrid(worldPoint.x),
    y: snapToGrid(worldPoint.y),
  })

  const zoomAroundScreenPoint = (targetZoom: number, screenPoint: Point) => {
    const nextZoom = clampViewportZoom(targetZoom)
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

  return {
    viewport,
    viewportRef,
    updateViewport,
    updatePan,
    screenToWorld,
    snapWorldPoint,
    zoomAroundScreenPoint,
    resetViewport,
  }
}

export function clampViewportZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

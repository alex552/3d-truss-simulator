import type { ReactElement } from 'react'
import { GRID_SIZE_PX, METERS_PER_GRID } from '../constants'

const MIN_MAJOR_GRID_SCREEN_SIZE_PX = 56
const MAJOR_GRID_MULTIPLIERS = [1, 2, 5]

export function ViewportGrid({
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
  const majorMultiple = getMajorGridMultiple(zoom)
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

export function getMajorGridStepMeters(zoom: number) {
  return getMajorGridMultiple(zoom) * METERS_PER_GRID
}

function getMajorGridMultiple(zoom: number) {
  if (zoom <= 0) {
    return 5
  }

  let decade = 1

  while (true) {
    for (const multiplier of MAJOR_GRID_MULTIPLIERS) {
      const majorMultiple = multiplier * decade

      if (GRID_SIZE_PX * majorMultiple * zoom >= MIN_MAJOR_GRID_SCREEN_SIZE_PX) {
        return majorMultiple
      }
    }

    decade *= 10
  }
}

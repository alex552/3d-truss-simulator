export const EDITOR_WIDTH = 520
export const EDITOR_HEIGHT = 520
export const GRID_SIZE_PX = 32
export const METERS_PER_GRID = 0.1
export const PIXELS_PER_METER = GRID_SIZE_PX / METERS_PER_GRID

export function snapToGrid(value: number) {
  return Math.round(value / GRID_SIZE_PX) * GRID_SIZE_PX
}

export function pixelsToMeters(value: number) {
  return (value / GRID_SIZE_PX) * METERS_PER_GRID
}

export function metersToPixels(value: number) {
  return (value / METERS_PER_GRID) * GRID_SIZE_PX
}

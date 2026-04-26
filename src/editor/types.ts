export type EditorTool = 'select' | 'drag' | 'node' | 'member'

export type SelectedEntity =
  | { type: 'node'; id: string }
  | { type: 'member'; id: string }
  | null

export type Point = {
  x: number
  y: number
}

export type Viewport = {
  zoom: number
  panX: number
  panY: number
}

export type PanSession = {
  startScreenPoint: Point
  startPanX: number
  startPanY: number
}

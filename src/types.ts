export type SupportType = 'fixed' | 'pinned' | 'roller-x' | 'roller-z'
export type HorizontalLoadDirection = 'left' | 'right'
export type VerticalLoadDirection = 'up' | 'down'

export type HorizontalLoad = {
  magnitudeKn: number
  direction: HorizontalLoadDirection
}

export type VerticalLoad = {
  magnitudeKn: number
  direction: VerticalLoadDirection
}

export type Node2D = {
  id: string
  // In the 2D editor, x is world X and y is treated as world Z.
  x: number
  y: number
  support?: SupportType
  horizontalLoad?: HorizontalLoad
  verticalLoad?: VerticalLoad
}

export type Member = {
  id: string
  nodeAId: string
  nodeBId: string
}

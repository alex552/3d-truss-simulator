export type SupportType = 'fixed' | 'pinned' | 'roller-x' | 'roller-z'

export type Node2D = {
  id: string
  // In the 2D editor, x is world X and y is treated as world Z.
  x: number
  y: number
  support?: SupportType
}

export type Member = {
  id: string
  nodeAId: string
  nodeBId: string
}

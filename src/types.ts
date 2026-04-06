export type SupportType = 'pinned' | 'roller-x' | 'roller-z'
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
  axialStiffnessKn: number
}

export type TrussAnalysisStatus =
  | 'stable-determinate'
  | 'stable-indeterminate'
  | 'unstable'
  | 'invalid'

export type TrussDeterminacy = 'mechanism' | 'determinate' | 'indeterminate'

export type NodeReaction = {
  nodeId: string
  xKn: number
  zKn: number
}

export type NodeDisplacement = {
  nodeId: string
  xMeters: number
  zMeters: number
  magnitudeMeters: number
}

export type MemberAnalysisState = 'tension' | 'compression' | 'zero'

export type MemberAnalysisResult = {
  memberId: string
  axialForceKn: number
  state: MemberAnalysisState
}

export type TrussAnalysisResult = {
  status: TrussAnalysisStatus
  determinacy: TrussDeterminacy
  determinacyValue: number
  jointCount: number
  memberCount: number
  reactionCount: number
  warnings: string[]
  errors: string[]
  reactions: NodeReaction[]
  displacements: NodeDisplacement[]
  memberResults: MemberAnalysisResult[]
  maxDisplacementMeters: number
}

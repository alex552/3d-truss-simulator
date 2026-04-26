import { DEFAULT_MEMBER_AXIAL_STIFFNESS_KN } from '../lib/truss-model'
import type {
  HorizontalLoadDirection,
  Member,
  Node2D,
  SupportType,
  VerticalLoadDirection,
} from '../types'

export type ModelSnapshot = {
  nodes: Node2D[]
  members: Member[]
}

export function createNode(id: string, x: number, y: number): Node2D {
  return {
    id,
    x,
    y,
  }
}

export function createMember(id: string, nodeAId: string, nodeBId: string): Member {
  return {
    id,
    nodeAId,
    nodeBId,
    axialStiffnessKn: DEFAULT_MEMBER_AXIAL_STIFFNESS_KN,
  }
}

export function moveNode(nodes: Node2D[], nodeId: string, x: number, y: number): Node2D[] {
  return nodes.map((node) =>
    node.id === nodeId
      ? {
          ...node,
          x,
          y,
        }
      : node,
  )
}

export function deleteNode(
  snapshot: ModelSnapshot,
  nodeId: string,
): ModelSnapshot {
  return {
    nodes: snapshot.nodes.filter((node) => node.id !== nodeId),
    members: snapshot.members.filter(
      (member) => member.nodeAId !== nodeId && member.nodeBId !== nodeId,
    ),
  }
}

export function deleteMember(members: Member[], memberId: string): Member[] {
  return members.filter((member) => member.id !== memberId)
}

export function setNodeSupport(
  nodes: Node2D[],
  nodeId: string,
  support: SupportType | undefined,
): Node2D[] {
  return nodes.map((node) =>
    node.id === nodeId
      ? {
          ...node,
          support,
        }
      : node,
  )
}

export function setMemberAxialStiffness(
  members: Member[],
  memberId: string,
  axialStiffnessKn: number,
): Member[] {
  return members.map((member) =>
    member.id === memberId
      ? {
          ...member,
          axialStiffnessKn,
        }
      : member,
  )
}

export function setNodeHorizontalLoad(
  nodes: Node2D[],
  nodeId: string,
  magnitudeKn: number,
  direction: HorizontalLoadDirection,
): Node2D[] {
  const normalizedMagnitudeKn = Math.max(0, magnitudeKn)

  return nodes.map((node) =>
    node.id === nodeId
      ? {
          ...node,
          horizontalLoad: {
            magnitudeKn: normalizedMagnitudeKn,
            direction,
          },
        }
      : node,
  )
}

export function setNodeVerticalLoad(
  nodes: Node2D[],
  nodeId: string,
  magnitudeKn: number,
  direction: VerticalLoadDirection,
): Node2D[] {
  const normalizedMagnitudeKn = Math.max(0, magnitudeKn)

  return nodes.map((node) =>
    node.id === nodeId
      ? {
          ...node,
          verticalLoad: {
            magnitudeKn: normalizedMagnitudeKn,
            direction,
          },
        }
      : node,
  )
}

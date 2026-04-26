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
  return deleteNodes(snapshot, [nodeId])
}

export function deleteNodes(
  snapshot: ModelSnapshot,
  nodeIds: string[],
): ModelSnapshot {
  const nodeIdSet = new Set(nodeIds)

  return {
    nodes: snapshot.nodes.filter((node) => !nodeIdSet.has(node.id)),
    members: snapshot.members.filter(
      (member) => !nodeIdSet.has(member.nodeAId) && !nodeIdSet.has(member.nodeBId),
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
  return setNodesSupport(nodes, [nodeId], support)
}

export function setNodesSupport(
  nodes: Node2D[],
  nodeIds: string[],
  support: SupportType | undefined,
): Node2D[] {
  const nodeIdSet = new Set(nodeIds)

  return nodes.map((node) =>
    nodeIdSet.has(node.id)
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
  return setNodesHorizontalLoad(nodes, [nodeId], magnitudeKn, direction)
}

export function setNodesHorizontalLoad(
  nodes: Node2D[],
  nodeIds: string[],
  magnitudeKn: number,
  direction: HorizontalLoadDirection,
): Node2D[] {
  const normalizedMagnitudeKn = Math.max(0, magnitudeKn)
  const nodeIdSet = new Set(nodeIds)

  return nodes.map((node) =>
    nodeIdSet.has(node.id)
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
  return setNodesVerticalLoad(nodes, [nodeId], magnitudeKn, direction)
}

export function setNodesVerticalLoad(
  nodes: Node2D[],
  nodeIds: string[],
  magnitudeKn: number,
  direction: VerticalLoadDirection,
): Node2D[] {
  const normalizedMagnitudeKn = Math.max(0, magnitudeKn)
  const nodeIdSet = new Set(nodeIds)

  return nodes.map((node) =>
    nodeIdSet.has(node.id)
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

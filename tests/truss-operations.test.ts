import { describe, expect, it } from 'vitest'
import {
  createMember,
  createNode,
  deleteNode,
  setNodeHorizontalLoad,
} from '../src/model/truss-operations'

describe('truss model operations', () => {
  it('creates plain node and member records with stable ids', () => {
    expect(createNode('node-1', 12, 24)).toEqual({
      id: 'node-1',
      x: 12,
      y: 24,
    })

    expect(createMember('member-1', 'node-1', 'node-2')).toMatchObject({
      id: 'member-1',
      nodeAId: 'node-1',
      nodeBId: 'node-2',
      axialStiffnessKn: 1_000_000,
    })
  })

  it('deletes connected members when a node is removed', () => {
    const snapshot = {
      nodes: [
        createNode('node-1', 0, 0),
        createNode('node-2', 10, 0),
        createNode('node-3', 20, 0),
      ],
      members: [
        createMember('member-1', 'node-1', 'node-2'),
        createMember('member-2', 'node-2', 'node-3'),
        createMember('member-3', 'node-1', 'node-3'),
      ],
    }

    const nextSnapshot = deleteNode(snapshot, 'node-2')

    expect(nextSnapshot.nodes.map((node) => node.id)).toEqual(['node-1', 'node-3'])
    expect(nextSnapshot.members.map((member) => member.id)).toEqual(['member-3'])
  })

  it('keeps horizontal load direction when magnitude is zero', () => {
    const nodes = [
      {
        ...createNode('node-1', 0, 0),
        horizontalLoad: { magnitudeKn: 5, direction: 'right' as const },
      },
    ]

    expect(setNodeHorizontalLoad(nodes, 'node-1', 0, 'left')[0].horizontalLoad).toEqual({
      magnitudeKn: 0,
      direction: 'left',
    })
  })
})

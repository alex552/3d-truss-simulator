import { describe, expect, it } from 'vitest'
import { metersToPixels } from '../src/constants'
import { analyzeTruss } from '../src/lib/analysis'
import type { Member, Node2D, SupportType } from '../src/types'

describe('analyzeTruss', () => {
  it('solves a textbook triangular truss with correct reactions and member forces', () => {
    const nodes = [
      createNode('A', 0, 0, { support: 'pinned' }),
      createNode('B', 1, 0, { support: 'roller-x' }),
      createNode('C', 0.5, 1, {
        verticalLoad: { magnitudeKn: 10, direction: 'down' },
      }),
    ]
    const members = [
      createMember('AB', 'A', 'B'),
      createMember('AC', 'A', 'C'),
      createMember('BC', 'B', 'C'),
    ]

    const analysis = analyzeTruss(nodes, members)

    expect(analysis.status).toBe('stable-determinate')
    expect(analysis.determinacyValue).toBe(0)
    expect(analysis.errors).toHaveLength(0)

    const reactions = mapById(analysis.reactions)
    expect(reactions.get('A')).toMatchObject({ xKn: 0, zKn: 5 })
    expect(reactions.get('B')).toMatchObject({ xKn: 0, zKn: 5 })

    const memberResults = mapById(analysis.memberResults)
    expect(memberResults.get('AB')?.axialForceKn).toBeCloseTo(2.5, 6)
    expect(memberResults.get('AB')?.state).toBe('tension')
    expect(memberResults.get('AC')?.axialForceKn).toBeCloseTo(-5.5901699437, 6)
    expect(memberResults.get('AC')?.state).toBe('compression')
    expect(memberResults.get('BC')?.axialForceKn).toBeCloseTo(-5.5901699437, 6)
    expect(memberResults.get('BC')?.state).toBe('compression')
  })

  it('uses the correct sign convention for horizontal loads and reactions', () => {
    const nodes = [
      createNode('A', 0, 0, { support: 'pinned' }),
      createNode('B', 1, 0, { support: 'roller-x' }),
      createNode('C', 0.5, 1, {
        horizontalLoad: { magnitudeKn: 6, direction: 'right' },
      }),
    ]
    const members = [
      createMember('AB', 'A', 'B'),
      createMember('AC', 'A', 'C'),
      createMember('BC', 'B', 'C'),
    ]

    const analysis = analyzeTruss(nodes, members)
    const reactions = mapById(analysis.reactions)
    const memberResults = mapById(analysis.memberResults)

    expect(analysis.status).toBe('stable-determinate')
    expect(reactions.get('A')?.xKn).toBeCloseTo(-6, 8)
    expect(reactions.get('A')?.zKn).toBeCloseTo(-6, 8)
    expect(reactions.get('B')?.xKn).toBeCloseTo(0, 8)
    expect(reactions.get('B')?.zKn).toBeCloseTo(6, 8)
    expect(memberResults.get('AC')?.state).toBe('tension')
    expect(memberResults.get('BC')?.state).toBe('compression')
    expect(memberResults.get('AB')?.axialForceKn).toBeCloseTo(3, 6)
  })

  it('maps roller supports to the intended restrained direction', () => {
    const nodes = [
      createNode('A', 0, 0, { support: 'pinned' }),
      createNode('B', 0, 1, { support: 'roller-z' }),
      createNode('C', 1, 0.5, {
        horizontalLoad: { magnitudeKn: 6, direction: 'right' },
      }),
    ]
    const members = [
      createMember('AB', 'A', 'B'),
      createMember('AC', 'A', 'C'),
      createMember('BC', 'B', 'C'),
    ]

    const analysis = analyzeTruss(nodes, members)
    const reactions = mapById(analysis.reactions)

    expect(analysis.status).toBe('stable-determinate')
    expect(Math.abs(reactions.get('B')?.xKn ?? 0)).toBeGreaterThan(0.001)
    expect(reactions.get('B')?.zKn ?? 0).toBeCloseTo(0, 8)
  })

  it('splits force by member EA in a stable indeterminate truss', () => {
    const nodes = [
      createNode('A', 0, 0, { support: 'pinned' }),
      createNode('B', 1, 0, { support: 'roller-x' }),
      createNode('C', 0.5, 1, {
        verticalLoad: { magnitudeKn: 10, direction: 'down' },
      }),
    ]
    const members = [
      createMember('AB', 'A', 'B'),
      createMember('AC-weak', 'A', 'C', 1000),
      createMember('AC-strong', 'A', 'C', 2000),
      createMember('BC', 'B', 'C'),
    ]

    const analysis = analyzeTruss(nodes, members)
    const memberResults = mapById(analysis.memberResults)
    const weakForce = memberResults.get('AC-weak')?.axialForceKn ?? 0
    const strongForce = memberResults.get('AC-strong')?.axialForceKn ?? 0

    expect(analysis.status).toBe('stable-indeterminate')
    expect(analysis.determinacyValue).toBe(1)
    expect(memberResults.get('AC-weak')?.state).toBe('compression')
    expect(memberResults.get('AC-strong')?.state).toBe('compression')
    expect(Math.abs(strongForce / weakForce)).toBeCloseTo(2, 6)
  })

  it('reports unstable systems when restraints are insufficient', () => {
    const nodes = [
      createNode('A', 0, 0, { support: 'pinned' }),
      createNode('B', 1, 0),
      createNode('C', 0.5, 1, {
        verticalLoad: { magnitudeKn: 10, direction: 'down' },
      }),
    ]
    const members = [
      createMember('AB', 'A', 'B'),
      createMember('AC', 'A', 'C'),
      createMember('BC', 'B', 'C'),
    ]

    const analysis = analyzeTruss(nodes, members)

    expect(analysis.status).toBe('unstable')
    expect(analysis.errors.join(' ')).toMatch(/singular|unstable/i)
  })

  it('reports invalid for zero-length members', () => {
    const nodes = [createNode('A', 0, 0), createNode('B', 0, 0)]
    const members = [createMember('AB', 'A', 'B')]

    const analysis = analyzeTruss(nodes, members)

    expect(analysis.status).toBe('invalid')
    expect(analysis.errors.join(' ')).toMatch(/zero length/i)
  })

  it('reports invalid for disconnected structural subgraphs', () => {
    const nodes = [
      createNode('A', 0, 0, { support: 'pinned' }),
      createNode('B', 1, 0),
      createNode('C', 3, 0, { support: 'roller-x' }),
      createNode('D', 4, 0, {
        verticalLoad: { magnitudeKn: 3, direction: 'down' },
      }),
    ]
    const members = [createMember('AB', 'A', 'B'), createMember('CD', 'C', 'D')]

    const analysis = analyzeTruss(nodes, members)

    expect(analysis.status).toBe('invalid')
    expect(analysis.errors.join(' ')).toMatch(/disconnected/i)
  })

  it('reports invalid for isolated supported or loaded nodes', () => {
    const nodes = [
      createNode('A', 0, 0, { support: 'pinned' }),
      createNode('B', 1, 0),
      createNode('C', 2, 0, {
        support: 'roller-x',
        verticalLoad: { magnitudeKn: 2, direction: 'down' },
      }),
    ]
    const members = [createMember('AB', 'A', 'B')]

    const analysis = analyzeTruss(nodes, members)

    expect(analysis.status).toBe('invalid')
    expect(analysis.errors.join(' ')).toMatch(/not connected/i)
  })

  it('normalizes legacy fixed supports to pinned behavior', () => {
    const nodes = [
      createNode('A', 0, 0, { support: 'fixed' as SupportType }),
      createNode('B', 1, 0, { support: 'roller-x' }),
      createNode('C', 0.5, 1, {
        verticalLoad: { magnitudeKn: 10, direction: 'down' },
      }),
    ] as Node2D[]
    const members = [
      createMember('AB', 'A', 'B'),
      createMember('AC', 'A', 'C'),
      createMember('BC', 'B', 'C'),
    ]

    const analysis = analyzeTruss(nodes, members)
    const reactions = mapById(analysis.reactions)

    expect(analysis.status).toBe('stable-determinate')
    expect(reactions.get('A')).toMatchObject({ xKn: 0, zKn: 5 })
  })
})

function createNode(
  id: string,
  xMeters: number,
  zMeters: number,
  overrides: Partial<Node2D> = {},
): Node2D {
  return {
    id,
    x: metersToPixels(xMeters),
    y: -metersToPixels(zMeters),
    ...overrides,
  }
}

function createMember(
  id: string,
  nodeAId: string,
  nodeBId: string,
  axialStiffnessKn = 1_000_000,
): Member {
  return {
    id,
    nodeAId,
    nodeBId,
    axialStiffnessKn,
  }
}

function mapById<T extends { nodeId?: string; memberId?: string; id?: string }>(items: T[]) {
  return new Map(
    items.map((item) => [item.nodeId ?? item.memberId ?? item.id ?? '', item]),
  )
}

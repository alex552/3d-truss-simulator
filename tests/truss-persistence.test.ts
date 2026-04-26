import { describe, expect, it } from 'vitest'
import { createMember, createNode } from '../src/model/truss-operations'
import { createPersistedModel, parsePersistedModel } from '../src/model/truss-persistence'

describe('truss persistence', () => {
  it('creates and parses a valid v1 model payload', () => {
    const snapshot = {
      nodes: [
        {
          ...createNode('node-1', 0, 0),
          support: 'pinned' as const,
          verticalLoad: { magnitudeKn: 4, direction: 'down' as const },
        },
      ],
      members: [createMember('member-1', 'node-1', 'node-2')],
    }

    const payload = createPersistedModel(snapshot)
    const parsed = parsePersistedModel(JSON.stringify(payload))

    expect(payload.version).toBe(1)
    expect(parsed).toEqual(snapshot)
  })

  it('rejects malformed model content', () => {
    expect(parsePersistedModel('{')).toBeNull()
    expect(parsePersistedModel(JSON.stringify({ version: 2, nodes: [], members: [] }))).toBeNull()
    expect(
      parsePersistedModel(
        JSON.stringify({
          version: 1,
          nodes: [{ id: 'node-1', x: 'bad', y: 0 }],
          members: [],
        }),
      ),
    ).toBeNull()
  })
})

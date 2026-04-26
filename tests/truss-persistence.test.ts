import { describe, expect, it } from 'vitest'
import { createMember, createNode } from '../src/model/truss-operations'
import {
  createPersistedModel,
  parsePersistedModel,
  readSessionModel,
  SESSION_MODEL_STORAGE_KEY,
  writeSessionModel,
} from '../src/model/truss-persistence'

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

  it('reads a valid session model payload', () => {
    const snapshot = {
      nodes: [createNode('node-1', 0, 0)],
      members: [],
    }
    const storage = new FakeStorage()

    storage.setItem(SESSION_MODEL_STORAGE_KEY, JSON.stringify(createPersistedModel(snapshot)))

    expect(readSessionModel(storage)).toEqual(snapshot)
  })

  it('returns null and removes malformed session model content', () => {
    const storage = new FakeStorage()

    storage.setItem(SESSION_MODEL_STORAGE_KEY, '{')

    expect(readSessionModel(storage)).toBeNull()
    expect(storage.getItem(SESSION_MODEL_STORAGE_KEY)).toBeNull()
  })

  it('does not throw when session model storage writes fail', () => {
    const storage = new ThrowingStorage()

    expect(() => writeSessionModel(storage, { nodes: [], members: [] })).not.toThrow()
  })
})

class FakeStorage implements Pick<Storage, 'getItem' | 'removeItem' | 'setItem'> {
  private items = new Map<string, string>()

  getItem(key: string) {
    return this.items.get(key) ?? null
  }

  removeItem(key: string) {
    this.items.delete(key)
  }

  setItem(key: string, value: string) {
    this.items.set(key, value)
  }
}

class ThrowingStorage implements Pick<Storage, 'getItem' | 'removeItem' | 'setItem'> {
  getItem() {
    throw new Error('Storage unavailable')
  }

  removeItem() {
    throw new Error('Storage unavailable')
  }

  setItem() {
    throw new Error('Storage unavailable')
  }
}

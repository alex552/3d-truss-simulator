import type { Member, Node2D } from '../types'
import type { ModelSnapshot } from './truss-operations'

export const MODEL_FILE_EXTENSION = '.truss.json'
export const SESSION_MODEL_STORAGE_KEY = 'truss-playground.session-model'

export type PersistedTrussModel = {
  version: 1
  nodes: Node2D[]
  members: Member[]
}

type SessionModelStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>

export function createPersistedModel(snapshot: ModelSnapshot): PersistedTrussModel {
  return {
    version: 1,
    nodes: snapshot.nodes,
    members: snapshot.members,
  }
}

export function parsePersistedModel(content: string): ModelSnapshot | null {
  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch {
    return null
  }

  if (!isRecord(parsed)) {
    return null
  }

  if (parsed.version !== 1 || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.members)) {
    return null
  }

  if (!parsed.nodes.every(isNode2D) || !parsed.members.every(isMember)) {
    return null
  }

  return {
    nodes: parsed.nodes,
    members: parsed.members,
  }
}

export function readSessionModel(
  storage: SessionModelStorage | null | undefined,
): ModelSnapshot | null {
  let content: string | null

  try {
    content = storage?.getItem(SESSION_MODEL_STORAGE_KEY) ?? null
  } catch {
    return null
  }

  if (!content) {
    return null
  }

  const snapshot = parsePersistedModel(content)

  if (!snapshot) {
    try {
      storage?.removeItem(SESSION_MODEL_STORAGE_KEY)
    } catch {
      // Ignore storage cleanup failures; recovery should never block editing.
    }
  }

  return snapshot
}

export function writeSessionModel(
  storage: SessionModelStorage | null | undefined,
  snapshot: ModelSnapshot,
) {
  try {
    storage?.setItem(SESSION_MODEL_STORAGE_KEY, JSON.stringify(createPersistedModel(snapshot)))
  } catch {
    // Ignore quota/privacy failures; explicit file save still works.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isHorizontalLoad(value: unknown): value is Node2D['horizontalLoad'] {
  if (!isRecord(value)) {
    return false
  }

  return (
    isFiniteNumber(value.magnitudeKn) &&
    (value.direction === 'left' || value.direction === 'right')
  )
}

function isVerticalLoad(value: unknown): value is Node2D['verticalLoad'] {
  if (!isRecord(value)) {
    return false
  }

  return (
    isFiniteNumber(value.magnitudeKn) &&
    (value.direction === 'up' || value.direction === 'down')
  )
}

function isNode2D(value: unknown): value is Node2D {
  if (!isRecord(value)) {
    return false
  }

  const hasValidSupport =
    value.support === undefined ||
    value.support === 'pinned' ||
    value.support === 'roller-x' ||
    value.support === 'roller-z' ||
    value.support === 'fixed'

  return (
    typeof value.id === 'string' &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    hasValidSupport &&
    (value.horizontalLoad === undefined || isHorizontalLoad(value.horizontalLoad)) &&
    (value.verticalLoad === undefined || isVerticalLoad(value.verticalLoad))
  )
}

function isMember(value: unknown): value is Member {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.nodeAId === 'string' &&
    typeof value.nodeBId === 'string' &&
    isFiniteNumber(value.axialStiffnessKn)
  )
}

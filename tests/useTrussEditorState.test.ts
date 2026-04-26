import { describe, expect, it } from 'vitest'
import {
  initialTrussEditorState,
  trussEditorReducer,
  type TrussEditorAction,
  type TrussEditorState,
} from '../src/editor/useTrussEditorState'

describe('truss editor reducer', () => {
  it('creates a node and selects it with the node tool', () => {
    const nodeToolState = reduce(initialTrussEditorState, {
      type: 'set-active-tool',
      tool: 'node',
    })

    const nextState = reduce(nodeToolState, {
      type: 'canvas-click',
      x: 10,
      y: 20,
      nodeId: 'node-1',
      memberId: 'unused-member',
    })

    expect(nextState.nodes).toMatchObject([{ id: 'node-1', x: 10, y: 20 }])
    expect(nextState.selectedEntity).toEqual({ type: 'node', id: 'node-1' })
    expect(nextState.undoStack).toHaveLength(1)
  })

  it('creates a member between existing nodes', () => {
    const state = {
      ...initialTrussEditorState,
      nodes: [
        { id: 'node-1', x: 0, y: 0 },
        { id: 'node-2', x: 10, y: 0 },
      ],
    }

    const startState = reduce(state, {
      type: 'node-click',
      nodeId: 'node-1',
      memberId: 'unused-member',
    })
    const nextState = reduce(startState, {
      type: 'node-click',
      nodeId: 'node-2',
      memberId: 'member-1',
    })

    expect(nextState.members).toMatchObject([
      { id: 'member-1', nodeAId: 'node-1', nodeBId: 'node-2' },
    ])
    expect(nextState.memberStartNodeId).toBeNull()
    expect(nextState.selectedEntity).toBeNull()
  })

  it('undoes and redoes model changes', () => {
    const nodeToolState = reduce(initialTrussEditorState, {
      type: 'set-active-tool',
      tool: 'node',
    })
    const editedState = reduce(nodeToolState, {
      type: 'canvas-click',
      x: 10,
      y: 20,
      nodeId: 'node-1',
      memberId: 'unused-member',
    })

    const undoneState = reduce(editedState, { type: 'undo' })
    const redoneState = reduce(undoneState, { type: 'redo' })

    expect(undoneState.nodes).toEqual([])
    expect(undoneState.redoStack).toHaveLength(1)
    expect(redoneState.nodes).toEqual(editedState.nodes)
    expect(redoneState.undoStack).toHaveLength(1)
  })

  it('keeps selected node load direction when magnitude is zero', () => {
    const state = {
      ...initialTrussEditorState,
      nodes: [
        {
          id: 'node-1',
          x: 0,
          y: 0,
          horizontalLoad: { magnitudeKn: 8, direction: 'right' as const },
        },
      ],
      selectedEntity: { type: 'node' as const, id: 'node-1' },
    }

    const nextState = reduce(state, {
      type: 'set-selected-node-horizontal-load',
      magnitudeKn: 0,
      direction: 'left',
    })

    expect(nextState.nodes[0].horizontalLoad).toEqual({
      magnitudeKn: 0,
      direction: 'left',
    })
  })
})

function reduce(state: TrussEditorState, action: TrussEditorAction) {
  return trussEditorReducer(state, action)
}

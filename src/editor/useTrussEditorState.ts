import { useMemo, useReducer } from 'react'
import {
  createMember,
  createNode,
  deleteMember,
  deleteNode,
  moveNode,
  setMemberAxialStiffness,
  setNodeHorizontalLoad,
  setNodeSupport,
  setNodeVerticalLoad,
  type ModelSnapshot,
} from '../model/truss-operations'
import type {
  HorizontalLoadDirection,
  SupportType,
  VerticalLoadDirection,
} from '../types'
import type { EditorTool, SelectedEntity } from './types'

const MAX_HISTORY_STEPS = 100

export type TrussEditorState = ModelSnapshot & {
  memberStartNodeId: string | null
  selectedEntity: SelectedEntity
  activeTool: EditorTool
  showForceResults: boolean
  showDeflectionResults: boolean
  undoStack: ModelSnapshot[]
  redoStack: ModelSnapshot[]
}

export type TrussEditorAction =
  | { type: 'canvas-click'; x: number; y: number; nodeId: string; memberId: string }
  | { type: 'node-click'; nodeId: string; memberId: string }
  | { type: 'member-click'; memberId: string }
  | { type: 'move-node'; nodeId: string; x: number; y: number }
  | { type: 'delete-node'; nodeId: string }
  | { type: 'delete-member'; memberId: string }
  | { type: 'set-active-tool'; tool: EditorTool }
  | { type: 'set-selected-node-support'; support: SupportType | undefined }
  | { type: 'set-selected-member-axial-stiffness'; axialStiffnessKn: number }
  | {
      type: 'set-selected-node-horizontal-load'
      magnitudeKn: number
      direction: HorizontalLoadDirection
    }
  | {
      type: 'set-selected-node-vertical-load'
      magnitudeKn: number
      direction: VerticalLoadDirection
    }
  | { type: 'load-model'; snapshot: ModelSnapshot }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'toggle-force-results' }
  | { type: 'toggle-deflection-results' }

export const initialTrussEditorState: TrussEditorState = {
  nodes: [],
  members: [],
  memberStartNodeId: null,
  selectedEntity: null,
  activeTool: 'member',
  showForceResults: true,
  showDeflectionResults: true,
  undoStack: [],
  redoStack: [],
}

export function trussEditorReducer(
  state: TrussEditorState,
  action: TrussEditorAction,
): TrussEditorState {
  switch (action.type) {
    case 'canvas-click': {
      if (state.activeTool === 'select') {
        return {
          ...state,
          selectedEntity: null,
        }
      }

      if (state.activeTool === 'drag') {
        return state
      }

      const node = createNode(action.nodeId, action.x, action.y)

      if (state.activeTool === 'node') {
        return withHistory(state, {
          ...state,
          nodes: [...state.nodes, node],
          selectedEntity: { type: 'node', id: node.id },
        })
      }

      if (!state.memberStartNodeId) {
        return withHistory(state, {
          ...state,
          nodes: [...state.nodes, node],
          memberStartNodeId: node.id,
          selectedEntity: { type: 'node', id: node.id },
        })
      }

      return withHistory(state, {
        ...state,
        nodes: [...state.nodes, node],
        members: [
          ...state.members,
          createMember(action.memberId, state.memberStartNodeId, node.id),
        ],
        memberStartNodeId: null,
        selectedEntity: null,
      })
    }

    case 'node-click': {
      if (state.activeTool === 'select') {
        return {
          ...state,
          selectedEntity: { type: 'node', id: action.nodeId },
        }
      }

      if (state.activeTool === 'node' || state.activeTool === 'drag') {
        return state
      }

      if (!state.memberStartNodeId) {
        return {
          ...state,
          memberStartNodeId: action.nodeId,
          selectedEntity: { type: 'node', id: action.nodeId },
        }
      }

      if (state.memberStartNodeId === action.nodeId) {
        return {
          ...state,
          memberStartNodeId: null,
          selectedEntity: { type: 'node', id: action.nodeId },
        }
      }

      return withHistory(state, {
        ...state,
        members: [
          ...state.members,
          createMember(action.memberId, state.memberStartNodeId, action.nodeId),
        ],
        memberStartNodeId: null,
        selectedEntity: null,
      })
    }

    case 'member-click': {
      if (state.activeTool !== 'select') {
        return state
      }

      return {
        ...state,
        selectedEntity: { type: 'member', id: action.memberId },
      }
    }

    case 'move-node':
      return withHistory(state, {
        ...state,
        nodes: moveNode(state.nodes, action.nodeId, action.x, action.y),
      })

    case 'delete-node': {
      const nextSnapshot = deleteNode(state, action.nodeId)
      return withHistory(state, {
        ...state,
        ...nextSnapshot,
        memberStartNodeId:
          state.memberStartNodeId === action.nodeId ? null : state.memberStartNodeId,
        selectedEntity:
          state.selectedEntity?.type === 'node' && state.selectedEntity.id === action.nodeId
            ? null
            : state.selectedEntity,
      })
    }

    case 'delete-member':
      return withHistory(state, {
        ...state,
        members: deleteMember(state.members, action.memberId),
        selectedEntity:
          state.selectedEntity?.type === 'member' && state.selectedEntity.id === action.memberId
            ? null
            : state.selectedEntity,
      })

    case 'set-active-tool':
      return {
        ...state,
        activeTool: action.tool,
        memberStartNodeId: action.tool !== 'member' ? null : state.memberStartNodeId,
      }

    case 'set-selected-node-support':
      if (state.selectedEntity?.type !== 'node') {
        return state
      }

      return withHistory(state, {
        ...state,
        nodes: setNodeSupport(state.nodes, state.selectedEntity.id, action.support),
      })

    case 'set-selected-member-axial-stiffness':
      if (state.selectedEntity?.type !== 'member') {
        return state
      }

      return withHistory(state, {
        ...state,
        members: setMemberAxialStiffness(
          state.members,
          state.selectedEntity.id,
          action.axialStiffnessKn,
        ),
      })

    case 'set-selected-node-horizontal-load':
      if (state.selectedEntity?.type !== 'node') {
        return state
      }

      return withHistory(state, {
        ...state,
        nodes: setNodeHorizontalLoad(
          state.nodes,
          state.selectedEntity.id,
          action.magnitudeKn,
          action.direction,
        ),
      })

    case 'set-selected-node-vertical-load':
      if (state.selectedEntity?.type !== 'node') {
        return state
      }

      return withHistory(state, {
        ...state,
        nodes: setNodeVerticalLoad(
          state.nodes,
          state.selectedEntity.id,
          action.magnitudeKn,
          action.direction,
        ),
      })

    case 'load-model':
      return withHistory(state, {
        ...state,
        nodes: action.snapshot.nodes,
        members: action.snapshot.members,
        memberStartNodeId: null,
        selectedEntity: null,
      })

    case 'undo': {
      const previousSnapshot = state.undoStack[state.undoStack.length - 1]
      if (!previousSnapshot) {
        return state
      }

      return {
        ...state,
        nodes: previousSnapshot.nodes,
        members: previousSnapshot.members,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [pickSnapshot(state), ...state.redoStack],
        memberStartNodeId: null,
        selectedEntity: null,
      }
    }

    case 'redo': {
      const [nextSnapshot, ...remainingRedoSnapshots] = state.redoStack
      if (!nextSnapshot) {
        return state
      }

      return {
        ...state,
        nodes: nextSnapshot.nodes,
        members: nextSnapshot.members,
        redoStack: remainingRedoSnapshots,
        undoStack: [...state.undoStack, pickSnapshot(state)],
        memberStartNodeId: null,
        selectedEntity: null,
      }
    }

    case 'toggle-force-results':
      return {
        ...state,
        showForceResults: !state.showForceResults,
      }

    case 'toggle-deflection-results':
      return {
        ...state,
        showDeflectionResults: !state.showDeflectionResults,
      }

    default:
      return state
  }
}

export function useTrussEditorState() {
  const [state, dispatch] = useReducer(trussEditorReducer, initialTrussEditorState)

  const canUndo = state.undoStack.length > 0
  const canRedo = state.redoStack.length > 0

  const actions = useMemo(
    () => ({
      handleCanvasClick: (x: number, y: number) =>
        dispatch({
          type: 'canvas-click',
          x,
          y,
          nodeId: crypto.randomUUID(),
          memberId: crypto.randomUUID(),
        }),
      handleNodeClick: (nodeId: string) =>
        dispatch({
          type: 'node-click',
          nodeId,
          memberId: crypto.randomUUID(),
        }),
      handleMemberClick: (memberId: string) => dispatch({ type: 'member-click', memberId }),
      handleMoveNode: (nodeId: string, x: number, y: number) =>
        dispatch({ type: 'move-node', nodeId, x, y }),
      handleDeleteNode: (nodeId: string) => dispatch({ type: 'delete-node', nodeId }),
      handleDeleteMember: (memberId: string) => dispatch({ type: 'delete-member', memberId }),
      handleSetActiveTool: (tool: EditorTool) => dispatch({ type: 'set-active-tool', tool }),
      handleSetSelectedNodeSupport: (support: SupportType | undefined) =>
        dispatch({ type: 'set-selected-node-support', support }),
      handleSetSelectedMemberAxialStiffness: (axialStiffnessKn: number) =>
        dispatch({ type: 'set-selected-member-axial-stiffness', axialStiffnessKn }),
      handleSetSelectedNodeHorizontalLoad: (
        magnitudeKn: number,
        direction: HorizontalLoadDirection,
      ) =>
        dispatch({
          type: 'set-selected-node-horizontal-load',
          magnitudeKn,
          direction,
        }),
      handleSetSelectedNodeVerticalLoad: (
        magnitudeKn: number,
        direction: VerticalLoadDirection,
      ) =>
        dispatch({
          type: 'set-selected-node-vertical-load',
          magnitudeKn,
          direction,
        }),
      handleLoadModel: (snapshot: ModelSnapshot) => dispatch({ type: 'load-model', snapshot }),
      handleUndo: () => dispatch({ type: 'undo' }),
      handleRedo: () => dispatch({ type: 'redo' }),
      handleToggleShowForceResults: () => dispatch({ type: 'toggle-force-results' }),
      handleToggleShowDeflectionResults: () => dispatch({ type: 'toggle-deflection-results' }),
    }),
    [],
  )

  return {
    state,
    canUndo,
    canRedo,
    actions,
  }
}

function withHistory(state: TrussEditorState, nextState: TrussEditorState): TrussEditorState {
  if (state.nodes === nextState.nodes && state.members === nextState.members) {
    return nextState
  }

  const nextUndoStack = [...state.undoStack, pickSnapshot(state)]

  return {
    ...nextState,
    undoStack:
      nextUndoStack.length <= MAX_HISTORY_STEPS
        ? nextUndoStack
        : nextUndoStack.slice(nextUndoStack.length - MAX_HISTORY_STEPS),
    redoStack: [],
  }
}

function pickSnapshot(snapshot: ModelSnapshot): ModelSnapshot {
  return {
    nodes: snapshot.nodes,
    members: snapshot.members,
  }
}

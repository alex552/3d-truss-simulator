import { useMemo, useReducer } from 'react'
import {
  createMember,
  createNode,
  deleteMember,
  deleteNode,
  deleteNodes,
  moveNode,
  setMemberAxialStiffness,
  setNodesHorizontalLoad,
  setNodesSupport,
  setNodesVerticalLoad,
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
  selectedNodeIds: string[]
  activeTool: EditorTool
  showForceResults: boolean
  showDeflectionResults: boolean
  undoStack: ModelSnapshot[]
  redoStack: ModelSnapshot[]
  nodeMoveSession: {
    nodeId: string
    snapshot: ModelSnapshot
  } | null
}

export type TrussEditorAction =
  | { type: 'canvas-click'; x: number; y: number; nodeId: string; memberId: string }
  | { type: 'node-click'; nodeId: string; memberId: string; additive?: boolean }
  | { type: 'member-click'; memberId: string }
  | { type: 'begin-node-move'; nodeId: string }
  | { type: 'preview-node-move'; nodeId: string; x: number; y: number }
  | { type: 'commit-node-move' }
  | { type: 'move-node'; nodeId: string; x: number; y: number }
  | { type: 'delete-node'; nodeId: string }
  | { type: 'delete-member'; memberId: string }
  | { type: 'delete-selection' }
  | { type: 'set-active-tool'; tool: EditorTool }
  | { type: 'cancel-member-drawing' }
  | { type: 'clear-model' }
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
  selectedNodeIds: [],
  activeTool: 'member',
  showForceResults: true,
  showDeflectionResults: true,
  undoStack: [],
  redoStack: [],
  nodeMoveSession: null,
}

export function createInitialTrussEditorState(
  snapshot: ModelSnapshot | null | undefined,
): TrussEditorState {
  if (!snapshot) {
    return initialTrussEditorState
  }

  return {
    ...initialTrussEditorState,
    nodes: snapshot.nodes,
    members: snapshot.members,
  }
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
          selectedNodeIds: [],
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
          selectedNodeIds: [node.id],
        })
      }

      if (!state.memberStartNodeId) {
        return withHistory(state, {
          ...state,
          nodes: [...state.nodes, node],
          memberStartNodeId: node.id,
          selectedEntity: { type: 'node', id: node.id },
          selectedNodeIds: [node.id],
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
        selectedNodeIds: [],
      })
    }

    case 'node-click': {
      if (state.activeTool === 'select') {
        if (action.additive) {
          return toggleNodeSelection(state, action.nodeId)
        }

        return {
          ...state,
          selectedEntity: { type: 'node', id: action.nodeId },
          selectedNodeIds: [action.nodeId],
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
          selectedNodeIds: [action.nodeId],
        }
      }

      if (state.memberStartNodeId === action.nodeId) {
        return {
          ...state,
          memberStartNodeId: null,
          selectedEntity: { type: 'node', id: action.nodeId },
          selectedNodeIds: [action.nodeId],
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
        selectedNodeIds: [],
      })
    }

    case 'member-click': {
      if (state.activeTool !== 'select') {
        return state
      }

      return {
        ...state,
        selectedEntity: { type: 'member', id: action.memberId },
        selectedNodeIds: [],
      }
    }

    case 'begin-node-move':
      if (!state.nodes.some((node) => node.id === action.nodeId)) {
        return state
      }

      return {
        ...state,
        nodeMoveSession: {
          nodeId: action.nodeId,
          snapshot: pickSnapshot(state),
        },
      }

    case 'preview-node-move': {
      if (state.nodeMoveSession?.nodeId !== action.nodeId) {
        return state
      }

      const node = state.nodes.find((candidate) => candidate.id === action.nodeId)
      if (!node || (node.x === action.x && node.y === action.y)) {
        return state
      }

      return {
        ...state,
        nodes: moveNode(state.nodes, action.nodeId, action.x, action.y),
      }
    }

    case 'commit-node-move': {
      const nodeMoveSession = state.nodeMoveSession
      if (!nodeMoveSession) {
        return state
      }

      const nextState = {
        ...state,
        nodeMoveSession: null,
      }

      if (areModelSnapshotsEqual(nodeMoveSession.snapshot, pickSnapshot(state))) {
        return nextState
      }

      return withUndoSnapshot(nextState, nodeMoveSession.snapshot)
    }

    case 'move-node':
      return withHistory(state, {
        ...state,
        nodes: moveNode(state.nodes, action.nodeId, action.x, action.y),
      })

    case 'delete-node': {
      const nextSnapshot = deleteNode(state, action.nodeId)
      const remainingSelectedNodeIds = state.selectedNodeIds.filter(
        (nodeId) => nodeId !== action.nodeId,
      )
      const nextSelectedNodeId =
        remainingSelectedNodeIds[remainingSelectedNodeIds.length - 1] ?? null

      return withHistory(state, {
        ...state,
        ...nextSnapshot,
        memberStartNodeId:
          state.memberStartNodeId === action.nodeId ? null : state.memberStartNodeId,
        selectedNodeIds: remainingSelectedNodeIds,
        selectedEntity:
          state.selectedEntity?.type === 'node' && state.selectedEntity.id === action.nodeId
            ? nextSelectedNodeId
              ? { type: 'node', id: nextSelectedNodeId }
              : null
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

    case 'delete-selection': {
      const selectedNodeIds = getSelectedNodeIds(state)

      if (selectedNodeIds.length > 0) {
        const nextSnapshot = deleteNodes(state, selectedNodeIds)

        return withHistory(state, {
          ...state,
          ...nextSnapshot,
          memberStartNodeId: selectedNodeIds.includes(state.memberStartNodeId ?? '')
            ? null
            : state.memberStartNodeId,
          selectedEntity: null,
          selectedNodeIds: [],
        })
      }

      if (state.selectedEntity?.type !== 'member') {
        return state
      }

      return withHistory(state, {
        ...state,
        members: deleteMember(state.members, state.selectedEntity.id),
        selectedEntity: null,
      })
    }

    case 'set-active-tool':
      return {
        ...state,
        activeTool: action.tool,
        memberStartNodeId: action.tool !== 'member' ? null : state.memberStartNodeId,
      }

    case 'cancel-member-drawing':
      return {
        ...state,
        memberStartNodeId: null,
      }

    case 'clear-model':
      if (state.nodes.length === 0 && state.members.length === 0) {
        return {
          ...state,
          memberStartNodeId: null,
          selectedEntity: null,
          selectedNodeIds: [],
        }
      }

      return withHistory(state, {
        ...state,
        nodes: [],
        members: [],
        memberStartNodeId: null,
        selectedEntity: null,
        selectedNodeIds: [],
        nodeMoveSession: null,
      })

    case 'set-selected-node-support': {
      const selectedNodeIds = getSelectedNodeIds(state)

      if (selectedNodeIds.length === 0) {
        return state
      }

      return withHistory(state, {
        ...state,
        nodes: setNodesSupport(state.nodes, selectedNodeIds, action.support),
      })
    }

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

    case 'set-selected-node-horizontal-load': {
      const selectedNodeIds = getSelectedNodeIds(state)

      if (selectedNodeIds.length === 0) {
        return state
      }

      return withHistory(state, {
        ...state,
        nodes: setNodesHorizontalLoad(
          state.nodes,
          selectedNodeIds,
          action.magnitudeKn,
          action.direction,
        ),
      })
    }

    case 'set-selected-node-vertical-load': {
      const selectedNodeIds = getSelectedNodeIds(state)

      if (selectedNodeIds.length === 0) {
        return state
      }

      return withHistory(state, {
        ...state,
        nodes: setNodesVerticalLoad(
          state.nodes,
          selectedNodeIds,
          action.magnitudeKn,
          action.direction,
        ),
      })
    }

    case 'load-model':
      return withHistory(state, {
        ...state,
        nodes: action.snapshot.nodes,
        members: action.snapshot.members,
        memberStartNodeId: null,
        selectedEntity: null,
        selectedNodeIds: [],
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
        selectedNodeIds: [],
        nodeMoveSession: null,
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
        selectedNodeIds: [],
        nodeMoveSession: null,
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

export function useTrussEditorState(initialSnapshot?: ModelSnapshot | null) {
  const [state, dispatch] = useReducer(
    trussEditorReducer,
    initialSnapshot,
    createInitialTrussEditorState,
  )

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
      handleNodeClick: (nodeId: string, additive = false) =>
        dispatch({
          type: 'node-click',
          nodeId,
          memberId: crypto.randomUUID(),
          additive,
        }),
      handleMemberClick: (memberId: string) => dispatch({ type: 'member-click', memberId }),
      handleBeginNodeMove: (nodeId: string) => dispatch({ type: 'begin-node-move', nodeId }),
      handlePreviewNodeMove: (nodeId: string, x: number, y: number) =>
        dispatch({ type: 'preview-node-move', nodeId, x, y }),
      handleCommitNodeMove: () => dispatch({ type: 'commit-node-move' }),
      handleDeleteNode: (nodeId: string) => dispatch({ type: 'delete-node', nodeId }),
      handleDeleteMember: (memberId: string) => dispatch({ type: 'delete-member', memberId }),
      handleDeleteSelection: () => dispatch({ type: 'delete-selection' }),
      handleSetActiveTool: (tool: EditorTool) => dispatch({ type: 'set-active-tool', tool }),
      handleCancelMemberDrawing: () => dispatch({ type: 'cancel-member-drawing' }),
      handleClearModel: () => dispatch({ type: 'clear-model' }),
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

  return withUndoSnapshot(
    {
      ...nextState,
      nodeMoveSession: null,
    },
    pickSnapshot(state),
  )
}

function withUndoSnapshot(state: TrussEditorState, snapshot: ModelSnapshot): TrussEditorState {
  const nextUndoStack = [...state.undoStack, snapshot]

  return {
    ...state,
    undoStack:
      nextUndoStack.length <= MAX_HISTORY_STEPS
        ? nextUndoStack
        : nextUndoStack.slice(nextUndoStack.length - MAX_HISTORY_STEPS),
    redoStack: [],
  }
}

function toggleNodeSelection(state: TrussEditorState, nodeId: string): TrussEditorState {
  const selectedNodeIds = getSelectedNodeIds(state)
  const isSelected = selectedNodeIds.includes(nodeId)
  const nextSelectedNodeIds = isSelected
    ? selectedNodeIds.filter((selectedNodeId) => selectedNodeId !== nodeId)
    : [...selectedNodeIds, nodeId]
  const nextSelectedNodeId =
    nextSelectedNodeIds[nextSelectedNodeIds.length - 1] ?? null

  return {
    ...state,
    selectedEntity: nextSelectedNodeId
      ? {
          type: 'node',
          id: nextSelectedNodeId,
        }
      : null,
    selectedNodeIds: nextSelectedNodeIds,
  }
}

function getSelectedNodeIds(state: TrussEditorState): string[] {
  if (state.selectedNodeIds.length > 0) {
    return state.selectedNodeIds
  }

  return state.selectedEntity?.type === 'node' ? [state.selectedEntity.id] : []
}

function pickSnapshot(snapshot: ModelSnapshot): ModelSnapshot {
  return {
    nodes: snapshot.nodes,
    members: snapshot.members,
  }
}

function areModelSnapshotsEqual(snapshotA: ModelSnapshot, snapshotB: ModelSnapshot) {
  return (
    snapshotA.nodes.length === snapshotB.nodes.length &&
    snapshotA.members.length === snapshotB.members.length &&
    snapshotA.nodes.every((nodeA, index) => areNodesEqual(nodeA, snapshotB.nodes[index])) &&
    snapshotA.members.every((memberA, index) => areMembersEqual(memberA, snapshotB.members[index]))
  )
}

function areNodesEqual(
  nodeA: ModelSnapshot['nodes'][number],
  nodeB: ModelSnapshot['nodes'][number] | undefined,
) {
  if (!nodeB) {
    return false
  }

  return (
    nodeA.id === nodeB.id &&
    nodeA.x === nodeB.x &&
    nodeA.y === nodeB.y &&
    nodeA.support === nodeB.support &&
    areHorizontalLoadsEqual(nodeA.horizontalLoad, nodeB.horizontalLoad) &&
    areVerticalLoadsEqual(nodeA.verticalLoad, nodeB.verticalLoad)
  )
}

function areMembersEqual(
  memberA: ModelSnapshot['members'][number],
  memberB: ModelSnapshot['members'][number] | undefined,
) {
  if (!memberB) {
    return false
  }

  return (
    memberA.id === memberB.id &&
    memberA.nodeAId === memberB.nodeAId &&
    memberA.nodeBId === memberB.nodeBId &&
    memberA.axialStiffnessKn === memberB.axialStiffnessKn
  )
}

function areHorizontalLoadsEqual(
  loadA: ModelSnapshot['nodes'][number]['horizontalLoad'],
  loadB: ModelSnapshot['nodes'][number]['horizontalLoad'],
) {
  return loadA?.magnitudeKn === loadB?.magnitudeKn && loadA?.direction === loadB?.direction
}

function areVerticalLoadsEqual(
  loadA: ModelSnapshot['nodes'][number]['verticalLoad'],
  loadB: ModelSnapshot['nodes'][number]['verticalLoad'],
) {
  return loadA?.magnitudeKn === loadB?.magnitudeKn && loadA?.direction === loadB?.direction
}

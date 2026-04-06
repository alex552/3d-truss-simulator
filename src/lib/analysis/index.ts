import { GRID_SIZE_PX } from '../../constants'
import {
  getMemberAxialStiffnessKn,
  normalizeSupportType,
  type RuntimeSupportType,
} from '../truss-model'
import type {
  Member,
  MemberAnalysisResult,
  Node2D,
  NodeDisplacement,
  NodeReaction,
  SupportType,
  TrussAnalysisResult,
  TrussDeterminacy,
} from '../../types'

type AnalysisNode = {
  id: string
  xMeters: number
  zMeters: number
  support?: SupportType
  loadXKn: number
  loadZKn: number
}

type AnalysisMember = {
  id: string
  nodeAId: string
  nodeBId: string
  axialStiffnessKn: number
}

const SOLVER_TOLERANCE = 1e-9
const MEMBER_FORCE_ZERO_TOLERANCE = 1e-6

export function analyzeTruss(nodes: Node2D[], members: Member[]): TrussAnalysisResult {
  const warnings: string[] = []
  const errors: string[] = []
  const nodeLookup = new Map<string, AnalysisNode>()

  nodes.forEach((node) => {
    nodeLookup.set(node.id, {
      id: node.id,
      xMeters: node.x / GRID_SIZE_PX,
      zMeters: -node.y / GRID_SIZE_PX,
      support: normalizeSupportType(node.support as RuntimeSupportType | undefined),
      loadXKn: getNodeLoadXKn(node),
      loadZKn: getNodeLoadZKn(node),
    })
  })

  const normalizedMembers: AnalysisMember[] = []
  const nodeDegree = new Map<string, number>()

  members.forEach((member) => {
    const nodeA = nodeLookup.get(member.nodeAId)
    const nodeB = nodeLookup.get(member.nodeBId)

    if (!nodeA || !nodeB) {
      errors.push(`Member ${formatEntityId(member.id)} references a missing node.`)
      return
    }

    const lengthMeters = Math.hypot(nodeB.xMeters - nodeA.xMeters, nodeB.zMeters - nodeA.zMeters)
    if (lengthMeters <= SOLVER_TOLERANCE) {
      errors.push(`Member ${formatEntityId(member.id)} has zero length.`)
      return
    }

    normalizedMembers.push({
      id: member.id,
      nodeAId: member.nodeAId,
      nodeBId: member.nodeBId,
      axialStiffnessKn: getMemberAxialStiffnessKn(member),
    })
    nodeDegree.set(member.nodeAId, (nodeDegree.get(member.nodeAId) ?? 0) + 1)
    nodeDegree.set(member.nodeBId, (nodeDegree.get(member.nodeBId) ?? 0) + 1)
  })

  const ignoredNodeCount = nodes.filter(
    (node) =>
      (nodeDegree.get(node.id) ?? 0) === 0 &&
      !normalizeSupportType(node.support as RuntimeSupportType | undefined) &&
      getNodeLoadXKn(node) === 0 &&
      getNodeLoadZKn(node) === 0,
  ).length

  if (ignoredNodeCount > 0) {
    warnings.push(
      `${ignoredNodeCount} standalone node${ignoredNodeCount === 1 ? ' is' : 's are'} ignored by analysis.`,
    )
  }

  nodes.forEach((node) => {
    if (
      (nodeDegree.get(node.id) ?? 0) === 0 &&
      (normalizeSupportType(node.support as RuntimeSupportType | undefined) ||
        getNodeLoadXKn(node) !== 0 ||
        getNodeLoadZKn(node) !== 0)
    ) {
      errors.push(
        `Node ${formatEntityId(node.id)} has support or load data but is not connected to any member.`,
      )
    }
  })

  const connectedNodeIds = new Set<string>(nodeDegree.keys())
  if (connectedNodeIds.size === 0) {
    errors.push('Add at least one valid member before running analysis.')
  }

  if (errors.length === 0) {
    const componentCount = countConnectedComponents(Array.from(connectedNodeIds), normalizedMembers)
    if (componentCount > 1) {
      errors.push('The truss graph is disconnected. Analysis requires one connected structural system.')
    }
  }

  const activeNodes = Array.from(connectedNodeIds)
    .map((nodeId) => nodeLookup.get(nodeId))
    .filter((node): node is AnalysisNode => Boolean(node))

  const reactionCount = activeNodes.reduce(
    (count, node) => count + getRestrainedDofIndices(node.support).length,
    0,
  )
  const determinacyValue = normalizedMembers.length + reactionCount - 2 * activeNodes.length
  const determinacy = getDeterminacy(determinacyValue)

  if (errors.length > 0) {
    return createFailureResult({
      status: 'invalid',
      errors,
      warnings,
      determinacy,
      determinacyValue,
      jointCount: activeNodes.length,
      memberCount: normalizedMembers.length,
      reactionCount,
    })
  }

  if (determinacyValue < 0) {
    warnings.push(
      `Static count indicates a mechanism: m + r - 2j = ${determinacyValue}. The stiffness solve will confirm stability.`,
    )
  }

  const dofByNodeId = new Map<string, number>()
  activeNodes.forEach((node, index) => {
    dofByNodeId.set(node.id, index * 2)
  })

  const totalDofs = activeNodes.length * 2
  const globalStiffness = createZeroMatrix(totalDofs)
  const loadVector = new Array<number>(totalDofs).fill(0)

  activeNodes.forEach((node) => {
    const baseDof = dofByNodeId.get(node.id)
    if (baseDof === undefined) {
      return
    }

    loadVector[baseDof] = node.loadXKn
    loadVector[baseDof + 1] = node.loadZKn
  })

  normalizedMembers.forEach((member) => {
    const nodeA = nodeLookup.get(member.nodeAId)
    const nodeB = nodeLookup.get(member.nodeBId)
    const baseA = dofByNodeId.get(member.nodeAId)
    const baseB = dofByNodeId.get(member.nodeBId)

    if (!nodeA || !nodeB || baseA === undefined || baseB === undefined) {
      return
    }

    const dx = nodeB.xMeters - nodeA.xMeters
    const dz = nodeB.zMeters - nodeA.zMeters
    const lengthMeters = Math.hypot(dx, dz)
    const cosine = dx / lengthMeters
    const sine = dz / lengthMeters
    const factor = member.axialStiffnessKn / lengthMeters

    const elementMatrix = [
      [cosine * cosine, cosine * sine, -cosine * cosine, -cosine * sine],
      [cosine * sine, sine * sine, -cosine * sine, -sine * sine],
      [-cosine * cosine, -cosine * sine, cosine * cosine, cosine * sine],
      [-cosine * sine, -sine * sine, cosine * sine, sine * sine],
    ]
    const dofIndices = [baseA, baseA + 1, baseB, baseB + 1]

    for (let row = 0; row < dofIndices.length; row += 1) {
      for (let column = 0; column < dofIndices.length; column += 1) {
        globalStiffness[dofIndices[row]][dofIndices[column]] += factor * elementMatrix[row][column]
      }
    }
  })

  const restrainedDofs = activeNodes.flatMap((node) => {
    const baseDof = dofByNodeId.get(node.id)
    if (baseDof === undefined) {
      return []
    }

    return getRestrainedDofIndices(node.support).map((offset) => baseDof + offset)
  })
  const restrainedDofSet = new Set(restrainedDofs)
  const freeDofs = Array.from({ length: totalDofs }, (_, index) => index).filter(
    (index) => !restrainedDofSet.has(index),
  )

  if (restrainedDofs.length === 0) {
    return createFailureResult({
      status: 'unstable',
      errors: ['The truss has no supports, so the system is unstable.'],
      warnings,
      determinacy,
      determinacyValue,
      jointCount: activeNodes.length,
      memberCount: normalizedMembers.length,
      reactionCount,
    })
  }

  const displacements = new Array<number>(totalDofs).fill(0)

  if (freeDofs.length > 0) {
    const reducedMatrix = pickMatrix(globalStiffness, freeDofs, freeDofs)
    const reducedLoads = freeDofs.map((index) => loadVector[index])
    const reducedSolution = solveLinearSystem(reducedMatrix, reducedLoads, SOLVER_TOLERANCE)

    if (!reducedSolution) {
      return createFailureResult({
        status: 'unstable',
        errors: ['The stiffness matrix is singular or ill-conditioned for the current support layout.'],
        warnings,
        determinacy,
        determinacyValue,
        jointCount: activeNodes.length,
        memberCount: normalizedMembers.length,
        reactionCount,
      })
    }

    freeDofs.forEach((dofIndex, solutionIndex) => {
      displacements[dofIndex] = reducedSolution[solutionIndex]
    })
  }

  const forceVector = multiplyMatrixVector(globalStiffness, displacements)
  const reactionsByNodeId = new Map<string, NodeReaction>()
  const nodeDisplacements: NodeDisplacement[] = []

  activeNodes.forEach((node) => {
    const baseDof = dofByNodeId.get(node.id)
    if (baseDof === undefined) {
      return
    }

    const xMeters = sanitizeSignedZero(displacements[baseDof])
    const zMeters = sanitizeSignedZero(displacements[baseDof + 1])
    nodeDisplacements.push({
      nodeId: node.id,
      xMeters,
      zMeters,
      magnitudeMeters: Math.hypot(xMeters, zMeters),
    })

    const support = getRestrainedDofIndices(node.support)
    reactionsByNodeId.set(node.id, {
      nodeId: node.id,
      xKn: support.includes(0) ? sanitizeSignedZero(forceVector[baseDof] - loadVector[baseDof]) : 0,
      zKn: support.includes(1)
        ? sanitizeSignedZero(forceVector[baseDof + 1] - loadVector[baseDof + 1])
        : 0,
    })
  })

  const memberResults: MemberAnalysisResult[] = normalizedMembers.map((member) => {
    const nodeA = nodeLookup.get(member.nodeAId)
    const nodeB = nodeLookup.get(member.nodeBId)
    const baseA = dofByNodeId.get(member.nodeAId)
    const baseB = dofByNodeId.get(member.nodeBId)

    if (!nodeA || !nodeB || baseA === undefined || baseB === undefined) {
      return {
        memberId: member.id,
        axialForceKn: 0,
        state: 'zero',
      }
    }

    const dx = nodeB.xMeters - nodeA.xMeters
    const dz = nodeB.zMeters - nodeA.zMeters
    const lengthMeters = Math.hypot(dx, dz)
    const cosine = dx / lengthMeters
    const sine = dz / lengthMeters
    const extension =
      cosine * (displacements[baseB] - displacements[baseA]) +
      sine * (displacements[baseB + 1] - displacements[baseA + 1])
    const axialForceKn = sanitizeSignedZero((member.axialStiffnessKn / lengthMeters) * extension)

    return {
      memberId: member.id,
      axialForceKn,
      state:
        Math.abs(axialForceKn) <= MEMBER_FORCE_ZERO_TOLERANCE
          ? 'zero'
          : axialForceKn > 0
            ? 'tension'
            : 'compression',
    }
  })

  const maxDisplacementMeters = nodeDisplacements.reduce(
    (maxValue, nodeDisplacement) => Math.max(maxValue, nodeDisplacement.magnitudeMeters),
    0,
  )

  return {
    status: determinacy === 'determinate' ? 'stable-determinate' : 'stable-indeterminate',
    determinacy,
    determinacyValue,
    jointCount: activeNodes.length,
    memberCount: normalizedMembers.length,
    reactionCount,
    warnings,
    errors: [],
    reactions: activeNodes
      .filter((node) => getRestrainedDofIndices(node.support).length > 0)
      .map((node) => reactionsByNodeId.get(node.id))
      .filter((reaction): reaction is NodeReaction => Boolean(reaction)),
    displacements: nodeDisplacements,
    memberResults,
    maxDisplacementMeters,
  }
}

function createFailureResult({
  status,
  errors,
  warnings,
  determinacy,
  determinacyValue,
  jointCount,
  memberCount,
  reactionCount,
}: {
  status: TrussAnalysisResult['status']
  errors: string[]
  warnings: string[]
  determinacy: TrussDeterminacy
  determinacyValue: number
  jointCount: number
  memberCount: number
  reactionCount: number
}): TrussAnalysisResult {
  return {
    status,
    determinacy,
    determinacyValue,
    jointCount,
    memberCount,
    reactionCount,
    warnings,
    errors,
    reactions: [],
    displacements: [],
    memberResults: [],
    maxDisplacementMeters: 0,
  }
}

function getNodeLoadXKn(node: Node2D): number {
  if (!node.horizontalLoad || node.horizontalLoad.magnitudeKn <= 0) {
    return 0
  }

  return node.horizontalLoad.direction === 'right'
    ? node.horizontalLoad.magnitudeKn
    : -node.horizontalLoad.magnitudeKn
}

function getNodeLoadZKn(node: Node2D): number {
  if (!node.verticalLoad || node.verticalLoad.magnitudeKn <= 0) {
    return 0
  }

  return node.verticalLoad.direction === 'up'
    ? node.verticalLoad.magnitudeKn
    : -node.verticalLoad.magnitudeKn
}

function getRestrainedDofIndices(support: SupportType | undefined): number[] {
  if (!support) {
    return []
  }

  if (support === 'pinned') {
    return [0, 1]
  }

  return support === 'roller-x' ? [1] : [0]
}

function getDeterminacy(value: number): TrussDeterminacy {
  if (value < 0) {
    return 'mechanism'
  }

  return value === 0 ? 'determinate' : 'indeterminate'
}

function countConnectedComponents(nodeIds: string[], members: AnalysisMember[]): number {
  const adjacency = new Map<string, string[]>()

  nodeIds.forEach((nodeId) => {
    adjacency.set(nodeId, [])
  })

  members.forEach((member) => {
    adjacency.get(member.nodeAId)?.push(member.nodeBId)
    adjacency.get(member.nodeBId)?.push(member.nodeAId)
  })

  const visited = new Set<string>()
  let components = 0

  nodeIds.forEach((nodeId) => {
    if (visited.has(nodeId)) {
      return
    }

    components += 1
    const stack = [nodeId]

    while (stack.length > 0) {
      const currentNodeId = stack.pop()
      if (!currentNodeId || visited.has(currentNodeId)) {
        continue
      }

      visited.add(currentNodeId)
      adjacency.get(currentNodeId)?.forEach((neighborNodeId) => {
        if (!visited.has(neighborNodeId)) {
          stack.push(neighborNodeId)
        }
      })
    }
  })

  return components
}

function createZeroMatrix(size: number): number[][] {
  return Array.from({ length: size }, () => new Array<number>(size).fill(0))
}

function pickMatrix(matrix: number[][], rowIndices: number[], columnIndices: number[]): number[][] {
  return rowIndices.map((rowIndex) => columnIndices.map((columnIndex) => matrix[rowIndex][columnIndex]))
}

function multiplyMatrixVector(matrix: number[][], vector: number[]): number[] {
  return matrix.map((row) =>
    row.reduce((sum, value, index) => sum + value * vector[index], 0),
  )
}

function solveLinearSystem(
  matrix: number[][],
  vector: number[],
  tolerance: number,
): number[] | null {
  const size = matrix.length
  const workingMatrix = matrix.map((row) => [...row])
  const workingVector = [...vector]

  for (let pivotColumn = 0; pivotColumn < size; pivotColumn += 1) {
    let pivotRow = pivotColumn
    let pivotMagnitude = Math.abs(workingMatrix[pivotRow][pivotColumn])

    for (let row = pivotColumn + 1; row < size; row += 1) {
      const candidateMagnitude = Math.abs(workingMatrix[row][pivotColumn])
      if (candidateMagnitude > pivotMagnitude) {
        pivotMagnitude = candidateMagnitude
        pivotRow = row
      }
    }

    if (pivotMagnitude <= tolerance) {
      return null
    }

    if (pivotRow !== pivotColumn) {
      ;[workingMatrix[pivotColumn], workingMatrix[pivotRow]] = [
        workingMatrix[pivotRow],
        workingMatrix[pivotColumn],
      ]
      ;[workingVector[pivotColumn], workingVector[pivotRow]] = [
        workingVector[pivotRow],
        workingVector[pivotColumn],
      ]
    }

    const pivotValue = workingMatrix[pivotColumn][pivotColumn]

    for (let row = pivotColumn + 1; row < size; row += 1) {
      const factor = workingMatrix[row][pivotColumn] / pivotValue

      if (Math.abs(factor) <= tolerance) {
        continue
      }

      for (let column = pivotColumn; column < size; column += 1) {
        workingMatrix[row][column] -= factor * workingMatrix[pivotColumn][column]
      }

      workingVector[row] -= factor * workingVector[pivotColumn]
    }
  }

  const solution = new Array<number>(size).fill(0)

  for (let row = size - 1; row >= 0; row -= 1) {
    let sum = workingVector[row]

    for (let column = row + 1; column < size; column += 1) {
      sum -= workingMatrix[row][column] * solution[column]
    }

    const diagonal = workingMatrix[row][row]
    if (Math.abs(diagonal) <= tolerance) {
      return null
    }

    solution[row] = sum / diagonal
  }

  return solution
}

function sanitizeSignedZero(value: number): number {
  return Math.abs(value) <= SOLVER_TOLERANCE ? 0 : value
}

function formatEntityId(id: string): string {
  return id.slice(0, 8)
}

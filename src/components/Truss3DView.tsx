import { Line, OrbitControls, Text } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo } from 'react'
import {
  EDITOR_HEIGHT,
  EDITOR_WIDTH,
  GRID_SIZE_PX,
  METERS_PER_GRID,
  pixelsToMeters,
} from '../constants'
import { normalizeSupportType, type RuntimeSupportType } from '../lib/truss-model'
import type {
  HorizontalLoad,
  Member,
  Node2D,
  SupportType,
  VerticalLoad,
} from '../types'

type Truss3DViewProps = {
  nodes: Node2D[]
  members: Member[]
}

function toWorldPosition(node: Node2D, lowestNodeY: number): [number, number, number] {
  return [
    pixelsToMeters(node.x - EDITOR_WIDTH / 2) / METERS_PER_GRID,
    0,
    pixelsToMeters(lowestNodeY - node.y) / METERS_PER_GRID,
  ]
}

function MemberLine({
  start,
  end,
}: {
  start: [number, number, number]
  end: [number, number, number]
}) {
  const points = useMemo<[number, number, number][]>(() => [start, end], [start, end])

  return <Line points={points} color="#111111" lineWidth={2} />
}

function SceneAxes() {
  return (
    <>
      <Line points={[[0, 0, 0], [2.8, 0, 0]]} color="#e03131" lineWidth={2} />
      <Line points={[[0, 0, 0], [0, 2.8, 0]]} color="#2f9e44" lineWidth={2} />
      <Line points={[[0, 0, 0], [0, 0, 2.8]]} color="#1971c2" lineWidth={2} />

      <Text position={[3.1, 0, 0]} fontSize={0.22} color="#e03131">
        X
      </Text>
      <Text position={[0, 3.1, 0]} fontSize={0.22} color="#2f9e44">
        Y
      </Text>
      <Text position={[0, 0, 3.1]} fontSize={0.22} color="#1971c2">
        Z
      </Text>
    </>
  )
}

function SupportMarker({
  position,
  support,
}: {
  position: [number, number, number]
  support: SupportType | RuntimeSupportType
}) {
  const basePosition: [number, number, number] = [position[0], -0.18, position[2] - 0.22]
  const normalizedSupport = normalizeSupportType(support)

  if (normalizedSupport === 'pinned') {
    return (
      <mesh position={basePosition} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.18, 0.28, 3]} />
        <meshStandardMaterial color="#495057" />
      </mesh>
    )
  }

  if (normalizedSupport === 'roller-x') {
    return (
      <group position={basePosition}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.18, 0.24, 3]} />
          <meshStandardMaterial color="#495057" />
        </mesh>
        <mesh position={[-0.08, 0, -0.16]}>
          <cylinderGeometry args={[0.05, 0.05, 0.06, 16]} />
          <meshStandardMaterial color="#868e96" />
        </mesh>
        <mesh position={[0.08, 0, -0.16]}>
          <cylinderGeometry args={[0.05, 0.05, 0.06, 16]} />
          <meshStandardMaterial color="#868e96" />
        </mesh>
      </group>
    )
  }

  return (
    <group position={basePosition}>
      <mesh rotation={[Math.PI / 2, 0, Math.PI / 2]}>
        <coneGeometry args={[0.18, 0.24, 3]} />
        <meshStandardMaterial color="#495057" />
      </mesh>
      <mesh position={[-0.16, 0, -0.05]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.06, 16]} />
        <meshStandardMaterial color="#868e96" />
      </mesh>
      <mesh position={[0.16, 0, -0.05]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.06, 16]} />
        <meshStandardMaterial color="#868e96" />
      </mesh>
    </group>
  )
}

function LoadMarker({
  position,
  horizontalLoad,
  verticalLoad,
}: {
  position: [number, number, number]
  horizontalLoad?: HorizontalLoad
  verticalLoad?: VerticalLoad
}) {
  return (
    <>
      {horizontalLoad ? (
        <DirectionalLoadArrow
          start={[position[0], 0.28, position[2] + 0.1]}
          axis={horizontalLoad.direction === 'left' ? 'negative-x' : 'positive-x'}
          magnitudeKn={horizontalLoad.magnitudeKn}
          labelOffset={[0, 0.12, 0.22]}
        />
      ) : null}
      {verticalLoad ? (
        <DirectionalLoadArrow
          start={[position[0] + 0.22, 0.28, position[2]]}
          axis={verticalLoad.direction === 'up' ? 'positive-z' : 'negative-z'}
          magnitudeKn={verticalLoad.magnitudeKn}
          labelOffset={[0.12, 0.12, 0]}
        />
      ) : null}
    </>
  )
}

function DirectionalLoadArrow({
  start,
  axis,
  magnitudeKn,
  labelOffset,
}: {
  start: [number, number, number]
  axis: 'positive-x' | 'negative-x' | 'positive-z' | 'negative-z'
  magnitudeKn: number
  labelOffset: [number, number, number]
}) {
  const arrowLength = Math.min(1.5, Math.max(0.55, 0.35 + magnitudeKn * 0.08))
  const end =
    axis === 'positive-x'
      ? ([start[0] + arrowLength, start[1], start[2]] as [number, number, number])
      : axis === 'negative-x'
        ? ([start[0] - arrowLength, start[1], start[2]] as [number, number, number])
        : axis === 'positive-z'
          ? ([start[0], start[1], start[2] + arrowLength] as [number, number, number])
          : ([start[0], start[1], start[2] - arrowLength] as [number, number, number])

  const headRotation =
    axis === 'positive-x'
      ? [0, 0, -Math.PI / 2]
      : axis === 'negative-x'
        ? [0, 0, Math.PI / 2]
        : axis === 'positive-z'
          ? [Math.PI / 2, 0, 0]
          : [-Math.PI / 2, 0, 0]

  return (
    <>
      <Line points={[start, end]} color="#c92a2a" lineWidth={2} />
      <mesh position={end} rotation={headRotation as [number, number, number]}>
        <coneGeometry args={[0.08, 0.18, 18]} />
        <meshStandardMaterial color="#c92a2a" />
      </mesh>
      <Text
        position={[
          (start[0] + end[0]) / 2 + labelOffset[0],
          (start[1] + end[1]) / 2 + labelOffset[1],
          (start[2] + end[2]) / 2 + labelOffset[2],
        ]}
        fontSize={0.16}
        color="#c92a2a"
      >
        {magnitudeKn.toFixed(1)} kN
      </Text>
    </>
  )
}

export function Truss3DView({ nodes, members }: Truss3DViewProps) {
  const lowestNodeY = useMemo(
    () => (nodes.length > 0 ? Math.max(...nodes.map((node) => node.y)) : 0),
    [nodes],
  )

  const nodeLookup = useMemo(
    () => new Map(nodes.map((node) => [node.id, toWorldPosition(node, lowestNodeY)])),
    [nodes, lowestNodeY],
  )

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>3D View</h2>
          <p>The 2D drawing is treated as the X/Z plane in 3D.</p>
        </div>
      </div>

      <div className="canvas-shell">
        <Canvas camera={{ position: [0, -8, 4], up: [0, 0, 1], fov: 50 }}>
          <color attach="background" args={['#f4f7fb']} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[6, 10, 8]} intensity={1.2} />
          <gridHelper args={[16, 16, '#d7deea', '#e8edf5']} rotation={[Math.PI / 2, 0, 0]} />
          <SceneAxes />

          {members.map((member) => {
            const start = nodeLookup.get(member.nodeAId)
            const end = nodeLookup.get(member.nodeBId)

            if (!start || !end) {
              return null
            }

            return <MemberLine key={member.id} start={start} end={end} />
          })}

          {nodes.map((node) => {
            const position = nodeLookup.get(node.id)

            if (!position) {
              return null
            }

            return (
              <group key={node.id}>
                {node.support ? <SupportMarker position={position} support={node.support} /> : null}
                {node.horizontalLoad || node.verticalLoad ? (
                  <LoadMarker
                    position={position}
                    horizontalLoad={node.horizontalLoad}
                    verticalLoad={node.verticalLoad}
                  />
                ) : null}
                <mesh position={position}>
                  <sphereGeometry args={[0.12, 24, 24]} />
                  <meshStandardMaterial color="#f76808" />
                </mesh>
              </group>
            )
          })}

          <OrbitControls
            makeDefault
            target={[0, 0, EDITOR_HEIGHT / (2 * GRID_SIZE_PX)]}
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI / 2 - 0.05}
          />
        </Canvas>
      </div>
    </div>
  )
}

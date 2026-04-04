import { Line, OrbitControls, Text } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo } from 'react'
import type { Member, Node2D } from '../types'

type Truss3DViewProps = {
  nodes: Node2D[]
  members: Member[]
}

function toWorldPosition(node: Node2D, lowestNodeY: number): [number, number, number] {
  return [(node.x - 260) / 60, 0, (lowestNodeY - node.y) / 60]
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
              <mesh key={node.id} position={position}>
                <sphereGeometry args={[0.12, 24, 24]} />
                <meshStandardMaterial color="#f76808" />
              </mesh>
            )
          })}

          <OrbitControls
            makeDefault
            target={[0, 0, 0]}
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI / 2 - 0.05}
          />
        </Canvas>
      </div>
    </div>
  )
}

import { Line, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo } from 'react'
import type { Member, Node2D } from '../types'

type Truss3DViewProps = {
  nodes: Node2D[]
  members: Member[]
}

function MemberLine({
  start,
  end,
}: {
  start: [number, number, number]
  end: [number, number, number]
}) {
  const points = useMemo<[number, number, number][]>(() => [start, end], [start, end])

  return <Line points={points} color="#2f6fed" lineWidth={2} />
}

export function Truss3DView({ nodes, members }: Truss3DViewProps) {
  const nodeLookup = useMemo(
    () =>
      new Map(
        nodes.map((node) => [
          node.id,
          [(node.x - 260) / 60, 0, (node.y - 260) / 60] as [number, number, number],
        ]),
      ),
    [nodes],
  )

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>3D View</h2>
          <p>Same nodes and members, mapped into 3D space.</p>
        </div>
      </div>

      <div className="canvas-shell">
        <Canvas camera={{ position: [0, 5, 8], fov: 50 }}>
          <color attach="background" args={['#f4f7fb']} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[6, 10, 8]} intensity={1.2} />
          <gridHelper args={[16, 16, '#d7deea', '#e8edf5']} />

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

          <OrbitControls makeDefault />
        </Canvas>
      </div>
    </div>
  )
}

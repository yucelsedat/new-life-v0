import { Environment as DreiEnvironment, MeshReflectorMaterial } from '@react-three/drei'
import { COLORS } from '../utils/constants'
import { GROUND_REFLECTOR_CONFIG } from './Materials'

export default function Environment() {
  return (
    <>
      <DreiEnvironment preset="night" environmentIntensity={0.55} />
      <fogExp2 attach="fog" args={[COLORS.void, 0.045]} />
      <color attach="background" args={[COLORS.void]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.1, 0]} receiveShadow>
        <planeGeometry args={GROUND_REFLECTOR_CONFIG.args} />
        <MeshReflectorMaterial
          resolution={GROUND_REFLECTOR_CONFIG.resolution}
          mixBlur={GROUND_REFLECTOR_CONFIG.mixBlur}
          mixStrength={GROUND_REFLECTOR_CONFIG.mixStrength}
          mirror={GROUND_REFLECTOR_CONFIG.mirror}
          color={GROUND_REFLECTOR_CONFIG.color}
          roughness={0.9}
          metalness={0.2}
          depthScale={0.4}
          minDepthThreshold={0.85}
          maxDepthThreshold={1.2}
        />
      </mesh>
    </>
  )
}

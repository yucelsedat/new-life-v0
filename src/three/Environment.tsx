import { Environment as DreiEnvironment, Lightformer, MeshReflectorMaterial } from '@react-three/drei'
import { COLORS } from '../utils/constants'
import { GROUND_REFLECTOR_CONFIG } from './Materials'

export default function Environment() {
  return (
    <>
      <DreiEnvironment resolution={256} frames={1} environmentIntensity={0.6}>
        <Lightformer form="ring" color={COLORS.goldBright} intensity={3} scale={6} position={[0, 4, -6]} target={[0, 0, 0]} />
        <Lightformer form="rect" color={COLORS.ice} intensity={1.5} scale={[8, 4]} position={[-6, 2, 2]} target={[0, 0, 0]} />
        <Lightformer form="rect" color={COLORS.gold} intensity={1.2} scale={[6, 3]} position={[6, 1, 3]} target={[0, 0, 0]} />
        <Lightformer form="circle" color={COLORS.abyss} intensity={0.6} scale={12} position={[0, -6, 4]} target={[0, 0, 0]} />
      </DreiEnvironment>

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

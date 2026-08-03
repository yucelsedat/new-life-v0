import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { QualityTier, World } from '../types/world'
import type { SpherePlacement } from '../utils/layout'
import { useFloatingAnimation, evaluateFloat } from '../hooks/useFloatingAnimation'
import { SPHERE, SCENE_PALETTES, ANIMATION } from '../utils/constants'
import { getGlassGeometry } from '../three/Materials'
import SphereGlassMaterial from './SphereGlassMaterial'
import ScenePreview from './ScenePreview'
import SphereCard from './SphereCard'

interface FloatingSphereProps {
  world: World
  placement: SpherePlacement
  quality: QualityTier
  hovered: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string, position: [number, number, number]) => void
}

export default function FloatingSphere({ world, placement, quality, hovered, onHover, onSelect }: FloatingSphereProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const phase = useFloatingAnimation(placement.position[0] * 977 + placement.position[2] * 331 + world.slot * 7)
  const scaleRef = useRef(1)

  const baseScale = placement.radius * (placement.isHero ? SPHERE.heroScaleBoost : 1)
  const segments = placement.isHero ? 64 : 32

  useFrame((state, delta) => {
    const { y, sway, rotationY } = evaluateFloat(state.clock.elapsedTime, phase)
    groupRef.current.position.set(placement.position[0] + sway, placement.position[1] + y, placement.position[2])
    groupRef.current.rotation.y = rotationY

    const targetScale = hovered ? baseScale * SPHERE.hoverScale : baseScale
    scaleRef.current = THREE.MathUtils.damp(scaleRef.current, targetScale, ANIMATION.hoverDampLambda, delta)
    groupRef.current.scale.setScalar(scaleRef.current)
  })

  return (
    <group
      ref={groupRef}
      onPointerOver={(event) => {
        event.stopPropagation()
        onHover(world.id)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={(event) => {
        event.stopPropagation()
        onHover(null)
        document.body.style.cursor = 'auto'
      }}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(world.id, placement.position)
      }}
    >
      <ScenePreview sceneId={world.sceneId} sceneImageUrl={world.sceneImageUrl} />
      <mesh geometry={getGlassGeometry(segments)}>
        <SphereGlassMaterial quality={quality} hovered={hovered} accentColor={SCENE_PALETTES[world.sceneId].accent} />
      </mesh>
      <SphereCard world={world} isHero={placement.isHero} expanded={placement.isHero || hovered} />
    </group>
  )
}

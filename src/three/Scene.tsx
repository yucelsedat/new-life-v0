import { Suspense, type RefObject } from 'react'
import { Canvas } from '@react-three/fiber'
import type { World } from '../types/world'
import type { ResponsiveLayout } from '../hooks/useResponsiveLayout'
import type { ParallaxRef } from '../hooks/useMouseParallax'
import { computeSpherePlacements } from '../utils/layout'
import { CAMERA } from '../utils/constants'
import Environment from './Environment'
import Lighting from './Lighting'
import CameraRig from './CameraRig'
import Effects from './Effects'
import type { CameraFocusState } from './cameraFocus'
import FloatingSphere from '../components/FloatingSphere'
import BackgroundParticles from '../components/BackgroundParticles'

interface SceneProps {
  worlds: World[]
  layout: ResponsiveLayout
  hoveredWorldId: string | null
  onHoverWorld: (id: string | null) => void
  onSelectWorld: (id: string, position: [number, number, number]) => void
  parallax: RefObject<ParallaxRef>
  cameraFocus: RefObject<CameraFocusState>
}

export default function Scene({ worlds, layout, hoveredWorldId, onHoverWorld, onSelectWorld, parallax, cameraFocus }: SceneProps) {
  const placements = computeSpherePlacements(
    worlds.map((world) => world.id),
    layout.arcSpreadScale,
  )
  const placementById = new Map(placements.map((placement) => [placement.id, placement]))

  return (
    <Canvas
      dpr={layout.dpr}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ fov: CAMERA.fov, position: [0, 0.4, CAMERA.restDistance] }}
    >
      <Suspense fallback={null}>
        <Environment />
        <Lighting />
        <BackgroundParticles />
        {worlds.map((world) => {
          const placement = placementById.get(world.id)
          if (!placement) return null
          return (
            <FloatingSphere
              key={world.id}
              world={world}
              placement={placement}
              quality={placement.isHero ? 'hero' : layout.satelliteQuality}
              hovered={hoveredWorldId === world.id}
              onHover={onHoverWorld}
              onSelect={onSelectWorld}
            />
          )
        })}
        <CameraRig parallax={parallax} focus={cameraFocus} />
        <Effects />
      </Suspense>
    </Canvas>
  )
}

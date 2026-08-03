import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshTransmissionMaterial } from '@react-three/drei'
import * as THREE from 'three'
import type { QualityTier } from '../types/world'
import { SPHERE, QUALITY } from '../utils/constants'

interface SphereGlassMaterialProps {
  quality: QualityTier
  hovered: boolean
  accentColor: string
}

interface TransmissionMaterialImpl {
  thickness: number
  chromaticAberration: number
  distortion: number
  envMapIntensity: number
}

export default function SphereGlassMaterial({ quality, hovered, accentColor }: SphereGlassMaterialProps) {
  const materialRef = useRef<TransmissionMaterialImpl>(null!)
  const rimColor = useRef(new THREE.Color(accentColor))
  const hoverAmount = useRef(0)

  useFrame((_, delta) => {
    if (!materialRef.current) return
    const target = hovered ? 1 : 0
    hoverAmount.current = THREE.MathUtils.damp(hoverAmount.current, target, 6, delta)
    const next = hoverAmount.current

    materialRef.current.thickness = THREE.MathUtils.lerp(0.5, 0.85, next)
    materialRef.current.chromaticAberration = THREE.MathUtils.lerp(0.025, 0.06, next)
    materialRef.current.distortion = THREE.MathUtils.lerp(0.08, 0.16, next)
    materialRef.current.envMapIntensity = THREE.MathUtils.lerp(1, 1.6, next)
  })

  if (quality === 'lite') {
    return (
      <meshPhysicalMaterial
        color={rimColor.current}
        transmission={0.92}
        roughness={SPHERE.glassRoughness}
        thickness={0.6}
        ior={SPHERE.glassIor}
        envMapIntensity={hovered ? 1.5 : 1}
        clearcoat={1}
      />
    )
  }

  if (quality === 'hero') {
    return (
      <MeshTransmissionMaterial
        ref={materialRef}
        transmission={1}
        thickness={0.5}
        roughness={SPHERE.glassRoughness}
        ior={SPHERE.glassIor}
        chromaticAberration={0.03}
        distortion={0.1}
        distortionScale={0.2}
        resolution={QUALITY.hero.resolution}
        samples={QUALITY.hero.samples}
        color={rimColor.current}
      />
    )
  }

  return (
    <MeshTransmissionMaterial
      ref={materialRef}
      transmissionSampler
      thickness={0.5}
      roughness={SPHERE.glassRoughness}
      ior={SPHERE.glassIor}
      chromaticAberration={0.02}
      distortion={0.06}
      distortionScale={0.15}
      samples={QUALITY.satellite.samples}
      color={rimColor.current}
    />
  )
}

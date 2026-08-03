import * as THREE from 'three'
import { SPHERE } from '../utils/constants'

const glassGeometryCache = new Map<number, THREE.SphereGeometry>()

export function getGlassGeometry(segments: 64 | 32): THREE.SphereGeometry {
  const cached = glassGeometryCache.get(segments)
  if (cached) return cached

  const geometry = new THREE.SphereGeometry(1, segments, segments)
  glassGeometryCache.set(segments, geometry)
  return geometry
}

let sceneGeometrySingleton: THREE.SphereGeometry | null = null

export function getSceneGeometry(): THREE.SphereGeometry {
  if (sceneGeometrySingleton) return sceneGeometrySingleton
  sceneGeometrySingleton = new THREE.SphereGeometry(SPHERE.innerSceneRatio, 48, 48)
  return sceneGeometrySingleton
}

export const GROUND_REFLECTOR_CONFIG = {
  args: [40, 40] as [number, number],
  resolution: 512,
  mixBlur: 8,
  mixStrength: 1.4,
  mirror: 0.35,
  color: '#0a0f1c',
} as const

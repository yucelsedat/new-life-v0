import { SPHERE } from './constants'

export interface SpherePlacement {
  id: string
  position: [number, number, number]
  radius: number
  isHero: boolean
}

export function computeSpherePlacements(worldIds: string[], arcSpreadScale: number): SpherePlacement[] {
  if (worldIds.length === 0) return []

  const [heroId, ...satelliteIds] = worldIds
  const placements: SpherePlacement[] = [
    { id: heroId, position: [0, 0, 0], radius: SPHERE.heroRadius, isHero: true },
  ]

  const count = satelliteIds.length
  const spread = SPHERE.arcSpreadRadians * arcSpreadScale

  satelliteIds.forEach((id, index) => {
    const t = count === 1 ? 0.5 : index / (count - 1)
    const angle = -spread / 2 + t * spread
    const ringRadius = SPHERE.heroRadius * 2.6
    const x = Math.sin(angle) * ringRadius
    const z = -Math.cos(angle) * ringRadius * 0.6 - 1.2
    const y = Math.sin(index * 1.7) * SPHERE.arcDepthVariance * 0.4
    placements.push({
      id,
      position: [x, y, z],
      radius: SPHERE.satelliteRadius * (0.82 + 0.18 * Math.abs(Math.cos(angle))),
      isHero: false,
    })
  })

  return placements
}

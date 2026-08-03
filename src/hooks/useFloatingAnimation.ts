import { useMemo } from 'react'
import { ANIMATION } from '../utils/constants'

export interface FloatPhase {
  floatPhase: number
  swayPhase: number
  rotateDirection: 1 | -1
}

function mulberry32(seed: number) {
  return function random() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function useFloatingAnimation(seed: number): FloatPhase {
  return useMemo(() => {
    const random = mulberry32(seed)
    return {
      floatPhase: random() * Math.PI * 2,
      swayPhase: random() * Math.PI * 2,
      rotateDirection: random() > 0.5 ? 1 : -1,
    }
  }, [seed])
}

export function evaluateFloat(elapsed: number, phase: FloatPhase) {
  const y = Math.sin(elapsed * ANIMATION.floatSpeed + phase.floatPhase) * ANIMATION.floatAmplitude
  const sway = Math.sin(elapsed * ANIMATION.swaySpeed + phase.swayPhase) * ANIMATION.swayAmplitude
  const rotationY = elapsed * ANIMATION.rotateSpeed * phase.rotateDirection
  return { y, sway, rotationY }
}

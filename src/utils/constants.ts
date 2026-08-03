import type { SceneId } from '../types/world'

export const COLORS = {
  void: '#05070E',
  abyss: '#0A0F1C',
  gold: '#C9A227',
  goldBright: '#E8C766',
  ice: '#8FB4C9',
} as const

export const SPHERE = {
  heroRadius: 1.4,
  satelliteRadius: 1.0,
  heroScaleBoost: 1.4,
  innerSceneRatio: 0.62,
  glassRoughness: 0.04,
  glassIor: 1.52,
  arcSpreadRadians: Math.PI * 0.72,
  arcDepthVariance: 0.6,
  hoverScale: 1.08,
} as const

export const CAMERA = {
  fov: 35,
  restDistance: 8.5,
  dollyDistance: 3.2,
  dollyDurationMs: 1400,
  parallaxStrength: 0.35,
  dampingLambda: 4,
} as const

export const ANIMATION = {
  floatAmplitude: 0.12,
  floatSpeed: 0.35,
  swayAmplitude: 0.06,
  swaySpeed: 0.22,
  rotateSpeed: 0.08,
  hoverDampLambda: 6,
} as const

export const QUALITY = {
  hero: { resolution: 512, samples: 8 },
  satellite: { resolution: 128, samples: 4 },
  lite: { resolution: 0, samples: 0 },
} as const

export const BREAKPOINTS = {
  tablet: 1024,
  mobile: 640,
} as const

export const SCENE_PALETTES: Record<SceneId, { base: string; accent: string; glow: string }> = {
  salon: { base: '#2A160C', accent: '#E8A356', glow: '#FFD9A0' },
  'yatak-odasi': { base: '#0F1230', accent: '#5C6BC0', glow: '#A9B6F5' },
  mutfak: { base: '#101A22', accent: '#6FA8B8', glow: '#C4EAF2' },
  ofis: { base: '#0A2320', accent: '#2FBF9F', glow: '#8FF0D6' },
  sehir: { base: '#1A0B2E', accent: '#C23FCE', glow: '#FF7EE8' },
  park: { base: '#0D1F10', accent: '#6FBF4F', glow: '#C9E88A' },
}

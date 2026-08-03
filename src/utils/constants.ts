import type { SceneId } from '../types/world'

export const COLORS = {
  void: '#05070E',
  abyss: '#0A0F1C',
  gold: '#C9A227',
  goldBright: '#E8C766',
  ice: '#8FB4C9',
} as const

export const TRANSITION_DURATION_MS = 1400

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

export const SCENE_IDS: SceneId[] = ['salon', 'yatak-odasi', 'mutfak', 'ofis', 'sehir', 'park']

export type SceneId =
  | 'salon'
  | 'yatak-odasi'
  | 'mutfak'
  | 'ofis'
  | 'sehir'
  | 'park'

export interface World {
  id: string
  slot: number
  name: string
  sceneId: SceneId
  sceneLabel: string
  sceneImageUrl: string | null
  progress: number
  playTimeMinutes: number
  lastPlayedAt: string
  createdAt: string
}

export interface Profile {
  id: string
  displayName: string
  avatarSeed: string
  xp: number
  level: number
  isPremium: boolean
  unreadNotifications: number
}

export interface SystemStatus {
  sqliteConnected: boolean
  aiConnected: boolean
  latencyMs: number | null
}

export type ImageKind = 'scene' | 'character'

export interface GalleryImage {
  id: string
  url: string
  originalName: string
  sizeBytes: number
  uploadedAt: string
  /** null = global library (not tied to a world) */
  worldId: string | null
  kind: ImageKind
  /** True when a scene, option, angle, story frame or world cover points at this image — it cannot be deleted. */
  inUse: boolean
}

export interface SceneLink {
  id: string
  fromSceneId: string
  toSceneId: string
  label: string
  positionX: number
  positionY: number
  createdAt: string
  toSceneName?: string | null
  /** Per-view pin placement, keyed by {@link viewKey}. Missing = use positionX/positionY. */
  anglePositions?: Record<string, { positionX: number; positionY: number }>
}

export interface SceneVariant {
  id: string
  sceneId: string
  imageUrl: string
  createdAt: string
}

export type AngleDirection = 'left' | 'right'

/**
 * Another viewing direction of the same option. `offset` is signed and relative to the
 * option image (offset 0, never stored): +1, +2… turning right, -1, -2… turning left.
 */
export interface SceneAngle {
  id: string
  sceneId: string
  variantId: string | null
  offset: number
  imageUrl: string
  createdAt: string
}

/** Key is a variant id, or 'base' for the scene's own image. */
export type SceneAngles = Record<string, SceneAngle[]>

export interface StoryFrame {
  id: string
  sceneId: string
  variantId: string | null
  angleOffset: number
  imageUrl: string
  position: number
}

/** Key is {@link viewKey} — one story per angle of per option. */
export type SceneStories = Record<string, StoryFrame[]>

/** Addresses one angle of one option: 'base#0', '<variantId>#-1', … */
export function viewKey(optionKey: string, angleOffset: number): string {
  return `${optionKey}#${angleOffset}`
}

export interface WorldScene {
  id: string
  worldId: string
  name: string
  imageUrl: string
  createdAt: string
  canvasX: number | null
  canvasY: number | null
  links?: SceneLink[]
  variants?: SceneVariant[]
  angles?: SceneAngles
  stories?: SceneStories
}

export interface WorldSceneGraph {
  scenes: WorldScene[]
  links: SceneLink[]
}

export type QualityTier = 'hero' | 'satellite' | 'lite'

export type LayoutBreakpoint = 'desktop' | 'tablet' | 'mobile'

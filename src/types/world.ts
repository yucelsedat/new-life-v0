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
}

export interface SceneVariant {
  id: string
  sceneId: string
  imageUrl: string
  createdAt: string
}

export interface StoryFrame {
  id: string
  sceneId: string
  variantId: string | null
  imageUrl: string
  position: number
}

/** Key is a variant id, or 'base' for the scene's own image. */
export type SceneStories = Record<string, StoryFrame[]>

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
  stories?: SceneStories
}

export interface WorldSceneGraph {
  scenes: WorldScene[]
  links: SceneLink[]
}

export type QualityTier = 'hero' | 'satellite' | 'lite'

export type LayoutBreakpoint = 'desktop' | 'tablet' | 'mobile'

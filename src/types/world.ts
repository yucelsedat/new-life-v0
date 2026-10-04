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
  /**
   * The angle the link is drawn on, in every option. Each view — the option image and
   * each of its angles — holds at most one link.
   */
  angleOffset: number
  createdAt: string
  toSceneName?: string | null
  /**
   * Per-view pin placement, keyed by {@link viewKey}. Missing = use positionX/positionY,
   * which is the placement on the base option at the link's own angle.
   */
  anglePositions?: Record<string, { positionX: number; positionY: number }>
}

/**
 * The same scene at a later point on the world clock. `optionIndex` is its place in that
 * chain (1 is the first option after the scene's own image, which is index 0) and is
 * shared world-wide: option 2 of every scene turns over at the same minute.
 */
export interface SceneVariant {
  id: string
  sceneId: string
  imageUrl: string
  optionIndex: number
  createdAt: string
}

/** When one option index takes over, as minutes since midnight on the world clock. */
export interface WorldOptionTime {
  optionIndex: number
  minuteOfDay: number
}

/** Which way a turn goes round a scene's ring: left is anticlockwise, right clockwise. */
export type AngleDirection = 'left' | 'right'

/**
 * Another viewing direction of the same option. `offset` is the slot its story and link
 * hang off — 0 is the option image and is never stored — and one slot is the same view
 * in every option. It says nothing about direction; that is `heading`.
 */
export interface SceneAngle {
  id: string
  sceneId: string
  variantId: string | null
  offset: number
  imageUrl: string
  createdAt: string
  /**
   * Which way this image looks, in degrees clockwise from 12 o'clock — its hand on the
   * scene's angle ring. Null on an angle from before headings existed.
   */
  heading: number | null
  /** Pulls in someone arriving from another location — see arrivalOffset. */
  magnetic: boolean
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
  /** Which way the scene's own image looks — and with it the image of every option. */
  heading: number
  /** Whether that image, the main view of every option, is magnetic. */
  magnetic: boolean
  links?: SceneLink[]
  variants?: SceneVariant[]
  angles?: SceneAngles
  stories?: SceneStories
}

export interface WorldSceneGraph {
  scenes: WorldScene[]
  links: SceneLink[]
}

/** A todo-style note kept against a world. `position` is the author's manual ordering. */
export interface WorldNote {
  id: string
  worldId: string
  title: string
  body: string
  done: boolean
  position: number
  createdAt: string
  updatedAt: string
}

export type QualityTier = 'hero' | 'satellite' | 'lite'

export type LayoutBreakpoint = 'desktop' | 'tablet' | 'mobile'

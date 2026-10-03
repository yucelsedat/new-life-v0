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

/**
 * The offset one turn away from `offset`. The option image and its angles form a full
 * circle, so turning past the last angle on one side comes back round from the other
 * side — the way someone turning on the spot ends up facing where they started.
 * Null when the option has no angles, since there is nowhere to turn to.
 */
export function turnAngle(offset: number, angles: SceneAngle[], direction: AngleDirection): number | null {
  if (angles.length === 0) return null
  // Offsets never leave gaps (deleting an angle takes everything beyond it too), so the
  // circle is every offset from the leftmost angle to the rightmost one, 0 included.
  const min = Math.min(0, ...angles.map((angle) => angle.offset))
  const max = Math.max(0, ...angles.map((angle) => angle.offset))
  if (direction === 'right') return offset >= max ? min : offset + 1
  return offset <= min ? max : offset - 1
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

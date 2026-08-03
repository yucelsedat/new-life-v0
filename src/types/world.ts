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

export interface GalleryImage {
  id: string
  url: string
  originalName: string
  sizeBytes: number
  uploadedAt: string
}

export type QualityTier = 'hero' | 'satellite' | 'lite'

export type LayoutBreakpoint = 'desktop' | 'tablet' | 'mobile'

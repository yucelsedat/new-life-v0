import type { Profile, World } from '../types/world'

export const FALLBACK_WORLDS: World[] = [
  { id: 'world-1', slot: 1, name: 'New Life #1', sceneId: 'salon', sceneLabel: 'Salon', sceneImageUrl: null, progress: 0.68, playTimeMinutes: 2140, lastPlayedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
  { id: 'world-2', slot: 2, name: 'New Life #2', sceneId: 'yatak-odasi', sceneLabel: 'Yatak Odası', sceneImageUrl: null, progress: 0.42, playTimeMinutes: 860, lastPlayedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
  { id: 'world-3', slot: 3, name: 'New Life #3', sceneId: 'mutfak', sceneLabel: 'Mutfak', sceneImageUrl: null, progress: 0.31, playTimeMinutes: 540, lastPlayedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
  { id: 'world-4', slot: 4, name: 'New Life #4', sceneId: 'ofis', sceneLabel: 'Ofis', sceneImageUrl: null, progress: 0.55, playTimeMinutes: 1290, lastPlayedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
  { id: 'world-5', slot: 5, name: 'New Life #5', sceneId: 'sehir', sceneLabel: 'Şehir', sceneImageUrl: null, progress: 0.19, playTimeMinutes: 210, lastPlayedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
  { id: 'world-6', slot: 6, name: 'New Life #6', sceneId: 'park', sceneLabel: 'Park', sceneImageUrl: null, progress: 0.04, playTimeMinutes: 35, lastPlayedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
]

export const FALLBACK_PROFILE: Profile = {
  id: 'player-1',
  displayName: 'Kaşif',
  avatarSeed: 'new-life-player-1',
  xp: 4280,
  level: 12,
  isPremium: true,
  unreadNotifications: 3,
}

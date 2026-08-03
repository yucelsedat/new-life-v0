import { Router } from 'express'
import { db } from '../db.ts'

export const profileRouter = Router()

interface ProfileRow {
  id: string
  display_name: string
  avatar_seed: string
  xp: number
  level: number
  is_premium: number
  unread_notifications: number
}

profileRouter.get('/', (_req, res) => {
  const row = db.prepare('SELECT * FROM profile LIMIT 1').get() as ProfileRow | undefined
  if (!row) {
    res.status(404).json({ error: 'Profile not found' })
    return
  }

  res.json({
    id: row.id,
    displayName: row.display_name,
    avatarSeed: row.avatar_seed,
    xp: row.xp,
    level: row.level,
    isPremium: Boolean(row.is_premium),
    unreadNotifications: row.unread_notifications,
  })
})

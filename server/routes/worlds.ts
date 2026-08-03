import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { db } from '../db.ts'

export const worldsRouter = Router()

interface WorldRow {
  id: string
  slot: number
  name: string
  scene_id: string
  scene_label: string
  scene_image_url: string | null
  progress: number
  play_time_minutes: number
  last_played_at: string
  created_at: string
}

function toWorld(row: WorldRow) {
  return {
    id: row.id,
    slot: row.slot,
    name: row.name,
    sceneId: row.scene_id,
    sceneLabel: row.scene_label,
    sceneImageUrl: row.scene_image_url,
    progress: row.progress,
    playTimeMinutes: row.play_time_minutes,
    lastPlayedAt: row.last_played_at,
    createdAt: row.created_at,
  }
}

worldsRouter.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM worlds ORDER BY slot ASC').all() as WorldRow[]
  res.json(rows.map(toWorld))
})

worldsRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM worlds WHERE id = ?').get(req.params.id) as WorldRow | undefined
  if (!row) {
    res.status(404).json({ error: 'World not found' })
    return
  }
  res.json(toWorld(row))
})

worldsRouter.post('/', (req, res) => {
  const { name, sceneId, sceneLabel } = req.body as { name?: string; sceneId?: string; sceneLabel?: string }
  if (!name || !sceneId || !sceneLabel) {
    res.status(400).json({ error: 'name, sceneId and sceneLabel are required' })
    return
  }

  const maxSlot = db.prepare('SELECT MAX(slot) as maxSlot FROM worlds').get() as { maxSlot: number | null }
  const slot = (maxSlot.maxSlot ?? 0) + 1
  const now = new Date().toISOString()
  const id = randomUUID()

  db.prepare(`
    INSERT INTO worlds (id, slot, name, scene_id, scene_label, scene_image_url, progress, play_time_minutes, last_played_at, created_at)
    VALUES (?, ?, ?, ?, ?, NULL, 0, 0, ?, ?)
  `).run(id, slot, name, sceneId, sceneLabel, now, now)

  const row = db.prepare('SELECT * FROM worlds WHERE id = ?').get(id) as WorldRow
  res.status(201).json(toWorld(row))
})

worldsRouter.patch('/:id/progress', (req, res) => {
  const { progress, playTimeMinutes } = req.body as { progress?: number; playTimeMinutes?: number }
  const existing = db.prepare('SELECT * FROM worlds WHERE id = ?').get(req.params.id) as WorldRow | undefined
  if (!existing) {
    res.status(404).json({ error: 'World not found' })
    return
  }

  const nextProgress = progress ?? existing.progress
  const nextPlayTime = playTimeMinutes ?? existing.play_time_minutes

  db.prepare(`
    UPDATE worlds SET progress = ?, play_time_minutes = ?, last_played_at = ? WHERE id = ?
  `).run(nextProgress, nextPlayTime, new Date().toISOString(), req.params.id)

  const row = db.prepare('SELECT * FROM worlds WHERE id = ?').get(req.params.id) as WorldRow
  res.json(toWorld(row))
})

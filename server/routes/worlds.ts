import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import { db } from '../db.ts'
import { uploadsDir } from './gallery.ts'

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

function resolveSceneImageUrl(row: WorldRow): string | null {
  if (row.scene_image_url) return row.scene_image_url
  const firstScene = db
    .prepare('SELECT image_url FROM scenes WHERE world_id = ? ORDER BY created_at ASC LIMIT 1')
    .get(row.id) as { image_url: string } | undefined
  return firstScene?.image_url ?? null
}

function toWorld(row: WorldRow) {
  return {
    id: row.id,
    slot: row.slot,
    name: row.name,
    sceneId: row.scene_id,
    sceneLabel: row.scene_label,
    sceneImageUrl: resolveSceneImageUrl(row),
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

worldsRouter.patch('/:id', (req, res) => {
  const { name, sceneId, sceneLabel } = req.body as {
    name?: string
    sceneId?: string
    sceneLabel?: string
  }

  const existing = db.prepare('SELECT * FROM worlds WHERE id = ?').get(req.params.id) as WorldRow | undefined
  if (!existing) {
    res.status(404).json({ error: 'World not found' })
    return
  }

  if (name !== undefined && !name.trim()) {
    res.status(400).json({ error: 'name cannot be empty' })
    return
  }

  db.prepare('UPDATE worlds SET name = ?, scene_id = ?, scene_label = ? WHERE id = ?').run(
    name?.trim() ?? existing.name,
    sceneId ?? existing.scene_id,
    sceneLabel ?? existing.scene_label,
    req.params.id,
  )

  const row = db.prepare('SELECT * FROM worlds WHERE id = ?').get(req.params.id) as WorldRow
  res.json(toWorld(row))
})

/**
 * Every image URL this world already consumes — as a scene background, a scene
 * option, or a story frame. Editor pickers use it to hide images already in use.
 */
worldsRouter.get('/:id/used-images', (req, res) => {
  const world = db.prepare('SELECT id FROM worlds WHERE id = ?').get(req.params.id)
  if (!world) {
    res.status(404).json({ error: 'World not found' })
    return
  }

  const rows = db
    .prepare(
      `SELECT image_url FROM scenes WHERE world_id = ?
       UNION
       SELECT image_url FROM scene_variants WHERE scene_id IN (SELECT id FROM scenes WHERE world_id = ?)
       UNION
       SELECT image_url FROM scene_angles WHERE scene_id IN (SELECT id FROM scenes WHERE world_id = ?)
       UNION
       SELECT image_url FROM story_frames WHERE scene_id IN (SELECT id FROM scenes WHERE world_id = ?)`,
    )
    .all(req.params.id, req.params.id, req.params.id, req.params.id) as { image_url: string }[]

  res.json({ urls: rows.map((row) => row.image_url) })
})

/** What a delete would take with it — shown in the confirmation dialog. */
worldsRouter.get('/:id/deletion-summary', (req, res) => {
  const world = db.prepare('SELECT * FROM worlds WHERE id = ?').get(req.params.id) as WorldRow | undefined
  if (!world) {
    res.status(404).json({ error: 'World not found' })
    return
  }

  const sceneIds = (
    db.prepare('SELECT id FROM scenes WHERE world_id = ?').all(req.params.id) as { id: string }[]
  ).map((row) => row.id)

  const placeholders = sceneIds.map(() => '?').join(',')
  const linkCount = sceneIds.length
    ? (db
        .prepare(`SELECT COUNT(*) c FROM scene_links WHERE from_scene_id IN (${placeholders})`)
        .get(...sceneIds) as { c: number }).c
    : 0
  const variantCount = sceneIds.length
    ? (db
        .prepare(`SELECT COUNT(*) c FROM scene_variants WHERE scene_id IN (${placeholders})`)
        .get(...sceneIds) as { c: number }).c
    : 0
  const angleCount = sceneIds.length
    ? (db
        .prepare(`SELECT COUNT(*) c FROM scene_angles WHERE scene_id IN (${placeholders})`)
        .get(...sceneIds) as { c: number }).c
    : 0
  const storyFrameCount = sceneIds.length
    ? (db
        .prepare(`SELECT COUNT(*) c FROM story_frames WHERE scene_id IN (${placeholders})`)
        .get(...sceneIds) as { c: number }).c
    : 0
  const imageCount = (
    db.prepare('SELECT COUNT(*) c FROM images WHERE world_id = ?').get(req.params.id) as { c: number }
  ).c

  res.json({
    worldName: world.name,
    scenes: sceneIds.length,
    links: linkCount,
    variants: variantCount,
    angles: angleCount,
    storyFrames: storyFrameCount,
    images: imageCount,
  })
})

worldsRouter.delete('/:id', (req, res) => {
  const world = db.prepare('SELECT * FROM worlds WHERE id = ?').get(req.params.id) as WorldRow | undefined
  if (!world) {
    res.status(404).json({ error: 'World not found' })
    return
  }

  const sceneIds = (
    db.prepare('SELECT id FROM scenes WHERE world_id = ?').all(req.params.id) as { id: string }[]
  ).map((row) => row.id)

  // Only images scoped to this world are removed; the global character library is never touched.
  const worldImages = db
    .prepare('SELECT filename FROM images WHERE world_id = ?')
    .all(req.params.id) as { filename: string }[]

  if (sceneIds.length) {
    const placeholders = sceneIds.map(() => '?').join(',')
    db.prepare(`DELETE FROM story_frames WHERE scene_id IN (${placeholders})`).run(...sceneIds)
    db.prepare(`DELETE FROM scene_variants WHERE scene_id IN (${placeholders})`).run(...sceneIds)
    db.prepare(`DELETE FROM scene_angles WHERE scene_id IN (${placeholders})`).run(...sceneIds)
    db.prepare(`
      DELETE FROM scene_link_angles
      WHERE link_id IN (SELECT id FROM scene_links WHERE from_scene_id IN (${placeholders}))
    `).run(...sceneIds)
    db.prepare(
      `DELETE FROM scene_links WHERE from_scene_id IN (${placeholders}) OR to_scene_id IN (${placeholders})`,
    ).run(...sceneIds, ...sceneIds)
  }
  db.prepare('DELETE FROM scenes WHERE world_id = ?').run(req.params.id)
  db.prepare('DELETE FROM images WHERE world_id = ?').run(req.params.id)
  db.prepare('DELETE FROM worlds WHERE id = ?').run(req.params.id)

  // Delete a file only once no image record anywhere still points at it — the same
  // upload can be referenced by another world or by the global character library.
  const stillReferenced = db.prepare('SELECT 1 FROM images WHERE filename = ? LIMIT 1')
  for (const image of worldImages) {
    if (stillReferenced.get(image.filename)) continue
    try {
      rmSync(join(uploadsDir, image.filename))
    } catch {
      // file already gone — the database record is what matters
    }
  }

  res.status(204).end()
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

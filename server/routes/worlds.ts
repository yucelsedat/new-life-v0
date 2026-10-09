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

/** Minutes since midnight. A world's clock opens at noon unless option 0 says otherwise. */
const DEFAULT_START_MINUTE = 12 * 60
const MINUTES_PER_DAY = 24 * 60

interface OptionTimeRow {
  option_index: number
  minute_of_day: number
}

/**
 * The activation minute of every option index of a world. Option 0 is always present:
 * it is the scene's own image, so its time is where the world's clock starts.
 */
function loadOptionTimes(worldId: string) {
  const rows = db
    .prepare('SELECT option_index, minute_of_day FROM world_option_times WHERE world_id = ? ORDER BY option_index ASC')
    .all(worldId) as OptionTimeRow[]

  const times = rows.map((row) => ({ optionIndex: row.option_index, minuteOfDay: row.minute_of_day }))
  if (!times.some((time) => time.optionIndex === 0)) {
    times.unshift({ optionIndex: 0, minuteOfDay: DEFAULT_START_MINUTE })
  }
  return times
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

type Row = Record<string, string | number | null>

/**
 * Copy a world and everything hanging off it into a new slot under a new name. Scenes,
 * options and links get fresh ids, so every reference between them is rewritten through
 * the id maps. Uploaded files are shared, not copied: the clone gets its own image records
 * pointing at the same files, and a delete only removes a file once no record uses it.
 * The copy starts unplayed — progress and play time are the player's, not the world's.
 */
worldsRouter.post('/:id/duplicate', (req, res) => {
  const { name } = req.body as { name?: string }

  const source = db.prepare('SELECT * FROM worlds WHERE id = ?').get(req.params.id) as WorldRow | undefined
  if (!source) {
    res.status(404).json({ error: 'World not found' })
    return
  }

  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' })
    return
  }

  const maxSlot = db.prepare('SELECT MAX(slot) as maxSlot FROM worlds').get() as { maxSlot: number | null }
  const slot = (maxSlot.maxSlot ?? 0) + 1
  const now = new Date().toISOString()
  const id = randomUUID()

  const sceneIds = new Map<string, string>()
  const variantIds = new Map<string, string>()
  const linkIds = new Map<string, string>()
  // undefined marks a row pointing at an option that no longer exists — it is left behind.
  const mapVariant = (variantId: string | null) => (variantId === null ? null : variantIds.get(variantId))

  db.exec('BEGIN')
  try {
    db.prepare(`
      INSERT INTO worlds (id, slot, name, scene_id, scene_label, scene_image_url, progress, play_time_minutes, last_played_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `).run(id, slot, name.trim(), source.scene_id, source.scene_label, source.scene_image_url, now, now)

    const scenes = db.prepare('SELECT * FROM scenes WHERE world_id = ?').all(source.id) as Row[]
    const insertScene = db.prepare(
      `INSERT INTO scenes (id, world_id, name, image_url, created_at, canvas_x, canvas_y, heading, magnetic)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const scene of scenes) {
      const sceneId = randomUUID()
      sceneIds.set(scene.id as string, sceneId)
      insertScene.run(
        sceneId,
        id,
        scene.name,
        scene.image_url,
        scene.created_at,
        scene.canvas_x,
        scene.canvas_y,
        scene.heading,
        scene.magnetic,
      )
    }

    const sourceSceneIds = [...sceneIds.keys()]
    const placeholders = sourceSceneIds.map(() => '?').join(',')
    const ofScenes = (table: string, column = 'scene_id') =>
      sourceSceneIds.length
        ? (db.prepare(`SELECT * FROM ${table} WHERE ${column} IN (${placeholders})`).all(...sourceSceneIds) as Row[])
        : []

    const insertVariant = db.prepare(
      'INSERT INTO scene_variants (id, scene_id, image_url, option_index, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    for (const variant of ofScenes('scene_variants')) {
      const variantId = randomUUID()
      variantIds.set(variant.id as string, variantId)
      insertVariant.run(
        variantId,
        sceneIds.get(variant.scene_id as string)!,
        variant.image_url,
        variant.option_index,
        variant.created_at,
      )
    }

    const insertAngle = db.prepare(`
      INSERT INTO scene_angles (id, scene_id, variant_id, angle_offset, image_url, created_at, heading, magnetic)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const angle of ofScenes('scene_angles')) {
      const variantId = mapVariant(angle.variant_id as string | null)
      if (variantId === undefined) continue
      insertAngle.run(
        randomUUID(),
        sceneIds.get(angle.scene_id as string)!,
        variantId,
        angle.angle_offset,
        angle.image_url,
        angle.created_at,
        angle.heading,
        angle.magnetic,
      )
    }

    const insertFrame = db.prepare(`
      INSERT INTO story_frames (id, scene_id, variant_id, angle_offset, image_url, position, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    for (const frame of ofScenes('story_frames')) {
      const variantId = mapVariant(frame.variant_id as string | null)
      if (variantId === undefined) continue
      insertFrame.run(
        randomUUID(),
        sceneIds.get(frame.scene_id as string)!,
        variantId,
        frame.angle_offset,
        frame.image_url,
        frame.position,
        frame.created_at,
      )
    }

    const insertLink = db.prepare(`
      INSERT INTO scene_links (id, from_scene_id, to_scene_id, label, position_x, position_y, angle_offset, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const link of ofScenes('scene_links', 'from_scene_id')) {
      const toSceneId = sceneIds.get(link.to_scene_id as string)
      if (!toSceneId) continue
      const linkId = randomUUID()
      linkIds.set(link.id as string, linkId)
      insertLink.run(
        linkId,
        sceneIds.get(link.from_scene_id as string)!,
        toSceneId,
        link.label,
        link.position_x,
        link.position_y,
        link.angle_offset,
        link.created_at,
      )
    }

    const sourceLinkIds = [...linkIds.keys()]
    const linkAngles = sourceLinkIds.length
      ? (db
          .prepare(`SELECT * FROM scene_link_angles WHERE link_id IN (${sourceLinkIds.map(() => '?').join(',')})`)
          .all(...sourceLinkIds) as Row[])
      : []
    const insertLinkAngle = db.prepare(`
      INSERT INTO scene_link_angles (link_id, variant_id, angle_offset, position_x, position_y)
      VALUES (?, ?, ?, ?, ?)
    `)
    for (const linkAngle of linkAngles) {
      const variantId = mapVariant(linkAngle.variant_id as string | null)
      if (variantId === undefined) continue
      insertLinkAngle.run(
        linkIds.get(linkAngle.link_id as string)!,
        variantId,
        linkAngle.angle_offset,
        linkAngle.position_x,
        linkAngle.position_y,
      )
    }

    const insertImage = db.prepare(`
      INSERT INTO images (id, filename, original_name, url, size_bytes, uploaded_at, world_id, kind)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const image of db.prepare('SELECT * FROM images WHERE world_id = ?').all(source.id) as Row[]) {
      insertImage.run(
        randomUUID(),
        image.filename,
        image.original_name,
        image.url,
        image.size_bytes,
        image.uploaded_at,
        id,
        image.kind,
      )
    }

    const insertNote = db.prepare(`
      INSERT INTO world_notes (id, world_id, title, body, done, position, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const note of db.prepare('SELECT * FROM world_notes WHERE world_id = ?').all(source.id) as Row[]) {
      insertNote.run(
        randomUUID(),
        id,
        note.title,
        note.body,
        note.done,
        note.position,
        note.created_at,
        note.updated_at,
      )
    }

    db.prepare(`
      INSERT INTO world_option_times (world_id, option_index, minute_of_day)
      SELECT ?, option_index, minute_of_day FROM world_option_times WHERE world_id = ?
    `).run(id, source.id)

    db.exec('COMMIT')
  } catch {
    db.exec('ROLLBACK')
    res.status(500).json({ error: 'World could not be duplicated' })
    return
  }

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
  const noteCount = (
    db.prepare('SELECT COUNT(*) c FROM world_notes WHERE world_id = ?').get(req.params.id) as { c: number }
  ).c

  res.json({
    worldName: world.name,
    scenes: sceneIds.length,
    links: linkCount,
    variants: variantCount,
    angles: angleCount,
    storyFrames: storyFrameCount,
    images: imageCount,
    notes: noteCount,
  })
})

worldsRouter.get('/:id/option-times', (req, res) => {
  const world = db.prepare('SELECT id FROM worlds WHERE id = ?').get(req.params.id)
  if (!world) {
    res.status(404).json({ error: 'World not found' })
    return
  }
  res.json(loadOptionTimes(req.params.id))
})

/**
 * Set when one option index takes over. The whole world turns over at once, so this is
 * deliberately not per scene: writing option 2's time here moves option 2 of every scene.
 */
worldsRouter.put('/:id/option-times/:optionIndex', (req, res) => {
  const world = db.prepare('SELECT id FROM worlds WHERE id = ?').get(req.params.id)
  if (!world) {
    res.status(404).json({ error: 'World not found' })
    return
  }

  const optionIndex = Number(req.params.optionIndex)
  if (!Number.isInteger(optionIndex) || optionIndex < 0) {
    res.status(400).json({ error: 'optionIndex must be a non-negative integer' })
    return
  }

  const { minuteOfDay } = req.body as { minuteOfDay?: number }
  if (!Number.isInteger(minuteOfDay) || minuteOfDay! < 0 || minuteOfDay! >= MINUTES_PER_DAY) {
    res.status(400).json({ error: 'minuteOfDay must be an integer between 0 and 1439' })
    return
  }

  db.prepare(`
    INSERT INTO world_option_times (world_id, option_index, minute_of_day) VALUES (?, ?, ?)
    ON CONFLICT (world_id, option_index) DO UPDATE SET minute_of_day = excluded.minute_of_day
  `).run(req.params.id, optionIndex, minuteOfDay!)

  res.json(loadOptionTimes(req.params.id))
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
  db.prepare('DELETE FROM world_notes WHERE world_id = ?').run(req.params.id)
  db.prepare('DELETE FROM world_option_times WHERE world_id = ?').run(req.params.id)
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

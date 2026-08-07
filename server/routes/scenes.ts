import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { db } from '../db.ts'

export const scenesRouter = Router()
export const sceneLinksRouter = Router()

interface SceneRow {
  id: string
  world_id: string
  name: string
  image_url: string
  created_at: string
  canvas_x: number | null
  canvas_y: number | null
}

interface SceneLinkRow {
  id: string
  from_scene_id: string
  to_scene_id: string
  label: string
  position_x: number
  position_y: number
  created_at: string
}

interface SceneVariantRow {
  id: string
  scene_id: string
  image_url: string
  created_at: string
}

function toSceneVariant(row: SceneVariantRow) {
  return {
    id: row.id,
    sceneId: row.scene_id,
    imageUrl: row.image_url,
    createdAt: row.created_at,
  }
}

function loadVariants(sceneId: string) {
  const rows = db
    .prepare('SELECT * FROM scene_variants WHERE scene_id = ? ORDER BY created_at ASC')
    .all(sceneId) as SceneVariantRow[]
  return rows.map(toSceneVariant)
}

/** An option is either the scene's own image ('base') or one of its variants. */
function optionKey(variantId: string | null): string {
  return variantId ?? 'base'
}

/** The inverse: 'base' (or nothing at all) means the scene's own image. */
function toVariantId(option: string | null | undefined): string | null {
  return !option || option === 'base' ? null : option
}

/** Addresses one angle of one option — the unit a story or a link placement hangs off. */
function viewKey(variantId: string | null, angleOffset: number): string {
  return `${optionKey(variantId)}#${angleOffset}`
}

function parseAngleOffset(value: unknown): number | null {
  if (value === undefined || value === null) return 0
  const offset = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(offset) ? offset : null
}

interface SceneAngleRow {
  id: string
  scene_id: string
  variant_id: string | null
  angle_offset: number
  image_url: string
  created_at: string
}

function toSceneAngle(row: SceneAngleRow) {
  return {
    id: row.id,
    sceneId: row.scene_id,
    variantId: row.variant_id,
    offset: row.angle_offset,
    imageUrl: row.image_url,
    createdAt: row.created_at,
  }
}

/** Every angle of a scene, keyed by option. Offset 0 is the option image and is never listed. */
function loadAngles(sceneId: string): Record<string, ReturnType<typeof toSceneAngle>[]> {
  const rows = db
    .prepare('SELECT * FROM scene_angles WHERE scene_id = ? ORDER BY angle_offset ASC')
    .all(sceneId) as SceneAngleRow[]

  const angles: Record<string, ReturnType<typeof toSceneAngle>[]> = {}
  for (const row of rows) {
    ;(angles[optionKey(row.variant_id)] ??= []).push(toSceneAngle(row))
  }
  return angles
}

function findAngle(sceneId: string, variantId: string | null, angleOffset: number) {
  const variantClause = variantId === null ? 'variant_id IS NULL' : 'variant_id = ?'
  const variantParams = variantId === null ? [] : [variantId]
  return db
    .prepare(`SELECT * FROM scene_angles WHERE scene_id = ? AND ${variantClause} AND angle_offset = ?`)
    .get(sceneId, ...variantParams, angleOffset) as SceneAngleRow | undefined
}

interface StoryFrameRow {
  id: string
  scene_id: string
  variant_id: string | null
  angle_offset: number
  image_url: string
  position: number
  created_at: string
}

function toStoryFrame(row: StoryFrameRow) {
  return {
    id: row.id,
    sceneId: row.scene_id,
    variantId: row.variant_id,
    angleOffset: row.angle_offset,
    imageUrl: row.image_url,
    position: row.position,
  }
}

/** Every story of a scene, keyed by `<option>#<angle>` — e.g. 'base#0', '<variantId>#-1'. */
function loadStories(sceneId: string): Record<string, ReturnType<typeof toStoryFrame>[]> {
  const rows = db
    .prepare('SELECT * FROM story_frames WHERE scene_id = ? ORDER BY position ASC')
    .all(sceneId) as StoryFrameRow[]

  const stories: Record<string, ReturnType<typeof toStoryFrame>[]> = {}
  for (const row of rows) {
    ;(stories[viewKey(row.variant_id, row.angle_offset)] ??= []).push(toStoryFrame(row))
  }
  return stories
}

interface SceneLinkAngleRow {
  link_id: string
  variant_id: string | null
  angle_offset: number
  position_x: number
  position_y: number
}

/** Per-angle placement overrides for one link, keyed the same way as stories. */
function loadLinkAnglePositions(linkId: string): Record<string, { positionX: number; positionY: number }> {
  const rows = db
    .prepare('SELECT * FROM scene_link_angles WHERE link_id = ?')
    .all(linkId) as SceneLinkAngleRow[]

  const positions: Record<string, { positionX: number; positionY: number }> = {}
  for (const row of rows) {
    positions[viewKey(row.variant_id, row.angle_offset)] = {
      positionX: row.position_x,
      positionY: row.position_y,
    }
  }
  return positions
}

/** Drop everything hanging off one angle of one option: its story and its link placements. */
function deleteAngleDependents(sceneId: string, variantId: string | null, angleOffset: number) {
  const variantClause = variantId === null ? 'variant_id IS NULL' : 'variant_id = ?'
  const variantParams = variantId === null ? [] : [variantId]

  db.prepare(
    `DELETE FROM story_frames WHERE scene_id = ? AND ${variantClause} AND angle_offset = ?`,
  ).run(sceneId, ...variantParams, angleOffset)

  db.prepare(`
    DELETE FROM scene_link_angles
    WHERE ${variantClause} AND angle_offset = ?
      AND link_id IN (SELECT id FROM scene_links WHERE from_scene_id = ?)
  `).run(...variantParams, angleOffset, sceneId)
}

function toScene(row: SceneRow) {
  return {
    id: row.id,
    worldId: row.world_id,
    name: row.name,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    canvasX: row.canvas_x,
    canvasY: row.canvas_y,
  }
}

function toSceneLink(row: SceneLinkRow) {
  return {
    id: row.id,
    fromSceneId: row.from_scene_id,
    toSceneId: row.to_scene_id,
    label: row.label,
    positionX: row.position_x,
    positionY: row.position_y,
    createdAt: row.created_at,
  }
}

scenesRouter.get('/', (req, res) => {
  const worldId = req.query.worldId as string | undefined
  if (!worldId) {
    res.status(400).json({ error: 'worldId query parameter is required' })
    return
  }

  const rows = db
    .prepare('SELECT * FROM scenes WHERE world_id = ? ORDER BY created_at ASC')
    .all(worldId) as SceneRow[]
  res.json(rows.map(toScene))
})

scenesRouter.get('/graph', (req, res) => {
  const worldId = req.query.worldId as string | undefined
  if (!worldId) {
    res.status(400).json({ error: 'worldId query parameter is required' })
    return
  }

  const sceneRows = db
    .prepare('SELECT * FROM scenes WHERE world_id = ? ORDER BY created_at ASC')
    .all(worldId) as SceneRow[]

  const sceneIds = sceneRows.map((row) => row.id)
  const linkRows =
    sceneIds.length === 0
      ? []
      : (db
          .prepare(`SELECT * FROM scene_links WHERE from_scene_id IN (${sceneIds.map(() => '?').join(',')})`)
          .all(...sceneIds) as SceneLinkRow[])

  res.json({
    scenes: sceneRows.map(toScene),
    links: linkRows.map(toSceneLink),
  })
})

scenesRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id) as SceneRow | undefined
  if (!row) {
    res.status(404).json({ error: 'Scene not found' })
    return
  }

  const linkRows = db
    .prepare('SELECT * FROM scene_links WHERE from_scene_id = ?')
    .all(req.params.id) as SceneLinkRow[]

  const links = linkRows.map((linkRow) => {
    const targetScene = db.prepare('SELECT * FROM scenes WHERE id = ?').get(linkRow.to_scene_id) as
      | SceneRow
      | undefined
    return {
      ...toSceneLink(linkRow),
      toSceneName: targetScene?.name ?? null,
      anglePositions: loadLinkAnglePositions(linkRow.id),
    }
  })

  res.json({
    ...toScene(row),
    links,
    variants: loadVariants(row.id),
    angles: loadAngles(row.id),
    stories: loadStories(row.id),
  })
})

/**
 * Replace the story for one angle of one option. `variantId` omitted (or 'base')
 * targets the scene's own image; otherwise it must be a variant of this scene.
 * `angleOffset` omitted means the option image itself. An empty imageUrls array
 * clears the story.
 */
scenesRouter.put('/:id/story', (req, res) => {
  const { variantId, angleOffset, imageUrls } = req.body as {
    variantId?: string | null
    angleOffset?: number
    imageUrls?: string[]
  }

  const scene = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id) as SceneRow | undefined
  if (!scene) {
    res.status(404).json({ error: 'Scene not found' })
    return
  }
  if (!Array.isArray(imageUrls)) {
    res.status(400).json({ error: 'imageUrls must be an array' })
    return
  }

  const offset = parseAngleOffset(angleOffset)
  if (offset === null) {
    res.status(400).json({ error: 'angleOffset must be an integer' })
    return
  }

  const targetVariant = toVariantId(variantId)
  if (targetVariant) {
    const variant = db
      .prepare('SELECT id FROM scene_variants WHERE id = ? AND scene_id = ?')
      .get(targetVariant, req.params.id)
    if (!variant) {
      res.status(404).json({ error: 'Variant not found on this scene' })
      return
    }
  }

  if (offset !== 0 && !findAngle(req.params.id, targetVariant, offset)) {
    res.status(404).json({ error: 'Angle not found on this option' })
    return
  }

  const variantClause = targetVariant === null ? 'variant_id IS NULL' : 'variant_id = ?'
  const variantParams = targetVariant === null ? [] : [targetVariant]
  db.prepare(
    `DELETE FROM story_frames WHERE scene_id = ? AND ${variantClause} AND angle_offset = ?`,
  ).run(req.params.id, ...variantParams, offset)

  const now = new Date().toISOString()
  const insert = db.prepare(`
    INSERT INTO story_frames (id, scene_id, variant_id, angle_offset, image_url, position, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  imageUrls.forEach((url, index) => {
    insert.run(randomUUID(), req.params.id, targetVariant, offset, url, index, now)
  })

  const key = viewKey(targetVariant, offset)
  res.json({ viewKey: key, frames: loadStories(req.params.id)[key] ?? [] })
})

scenesRouter.post('/:id/variants', (req, res) => {
  const { imageUrl } = req.body as { imageUrl?: string }
  if (!imageUrl) {
    res.status(400).json({ error: 'imageUrl is required' })
    return
  }

  const scene = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id) as SceneRow | undefined
  if (!scene) {
    res.status(404).json({ error: 'Scene not found' })
    return
  }

  if (scene.image_url === imageUrl) {
    res.status(409).json({ error: 'Image is already the base image of this scene' })
    return
  }

  const duplicate = db
    .prepare('SELECT id FROM scene_variants WHERE scene_id = ? AND image_url = ?')
    .get(req.params.id, imageUrl)
  if (duplicate) {
    res.status(409).json({ error: 'Image is already a variant of this scene' })
    return
  }

  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare('INSERT INTO scene_variants (id, scene_id, image_url, created_at) VALUES (?, ?, ?, ?)').run(
    id,
    req.params.id,
    imageUrl,
    now,
  )

  const row = db.prepare('SELECT * FROM scene_variants WHERE id = ?').get(id) as SceneVariantRow
  res.status(201).json(toSceneVariant(row))
})

scenesRouter.delete('/:id/variants/:variantId', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM scene_variants WHERE id = ? AND scene_id = ?')
    .get(req.params.variantId, req.params.id) as SceneVariantRow | undefined
  if (!existing) {
    res.status(404).json({ error: 'Variant not found' })
    return
  }

  // Angles, stories and link placements only exist relative to this option.
  db.prepare('DELETE FROM story_frames WHERE scene_id = ? AND variant_id = ?').run(
    req.params.id,
    req.params.variantId,
  )
  db.prepare('DELETE FROM scene_angles WHERE scene_id = ? AND variant_id = ?').run(
    req.params.id,
    req.params.variantId,
  )
  db.prepare(`
    DELETE FROM scene_link_angles
    WHERE variant_id = ? AND link_id IN (SELECT id FROM scene_links WHERE from_scene_id = ?)
  `).run(req.params.variantId, req.params.id)
  db.prepare('DELETE FROM scene_variants WHERE id = ?').run(req.params.variantId)
  res.status(204).end()
})

/**
 * Add a viewing angle next to the one currently on screen. `direction` decides which
 * way you turn from `fromOffset`, so angles grow outwards as a chain in each direction:
 * 0 → +1 → +2 to the right, 0 → -1 → -2 to the left.
 */
scenesRouter.post('/:id/angles', (req, res) => {
  const { variantId, fromOffset, direction, imageUrl } = req.body as {
    variantId?: string | null
    fromOffset?: number
    direction?: string
    imageUrl?: string
  }

  if (direction !== 'left' && direction !== 'right') {
    res.status(400).json({ error: "direction must be 'left' or 'right'" })
    return
  }
  if (!imageUrl) {
    res.status(400).json({ error: 'imageUrl is required' })
    return
  }

  const scene = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id) as SceneRow | undefined
  if (!scene) {
    res.status(404).json({ error: 'Scene not found' })
    return
  }

  const from = parseAngleOffset(fromOffset)
  if (from === null) {
    res.status(400).json({ error: 'fromOffset must be an integer' })
    return
  }

  const targetVariant = toVariantId(variantId)
  let optionImageUrl = scene.image_url
  if (targetVariant) {
    const variant = db
      .prepare('SELECT * FROM scene_variants WHERE id = ? AND scene_id = ?')
      .get(targetVariant, req.params.id) as SceneVariantRow | undefined
    if (!variant) {
      res.status(404).json({ error: 'Variant not found on this scene' })
      return
    }
    optionImageUrl = variant.image_url
  }

  if (from !== 0 && !findAngle(req.params.id, targetVariant, from)) {
    res.status(404).json({ error: 'Angle not found on this option' })
    return
  }

  const offset = from + (direction === 'right' ? 1 : -1)
  if (findAngle(req.params.id, targetVariant, offset)) {
    res.status(409).json({ error: 'This option already has an angle in that direction' })
    return
  }

  if (imageUrl === optionImageUrl) {
    res.status(409).json({ error: 'Image is already the image of this option' })
    return
  }
  const variantClause = targetVariant === null ? 'variant_id IS NULL' : 'variant_id = ?'
  const variantParams = targetVariant === null ? [] : [targetVariant]
  const duplicate = db
    .prepare(`SELECT id FROM scene_angles WHERE scene_id = ? AND ${variantClause} AND image_url = ?`)
    .get(req.params.id, ...variantParams, imageUrl)
  if (duplicate) {
    res.status(409).json({ error: 'Image is already an angle of this option' })
    return
  }

  const id = randomUUID()
  db.prepare(`
    INSERT INTO scene_angles (id, scene_id, variant_id, angle_offset, image_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, targetVariant, offset, imageUrl, new Date().toISOString())

  const row = db.prepare('SELECT * FROM scene_angles WHERE id = ?').get(id) as SceneAngleRow
  res.status(201).json(toSceneAngle(row))
})

/** Swap the image behind one angle. */
scenesRouter.patch('/:id/angles/:angleId/image', (req, res) => {
  const { imageUrl } = req.body as { imageUrl?: string }
  if (!imageUrl) {
    res.status(400).json({ error: 'imageUrl is required' })
    return
  }

  const angle = db
    .prepare('SELECT * FROM scene_angles WHERE id = ? AND scene_id = ?')
    .get(req.params.angleId, req.params.id) as SceneAngleRow | undefined
  if (!angle) {
    res.status(404).json({ error: 'Angle not found on this scene' })
    return
  }

  db.prepare('UPDATE scene_angles SET image_url = ? WHERE id = ?').run(imageUrl, req.params.angleId)
  const row = db.prepare('SELECT * FROM scene_angles WHERE id = ?').get(req.params.angleId) as SceneAngleRow
  res.json(toSceneAngle(row))
})

/**
 * Remove an angle. Everything further out on the same side goes with it — those angles
 * were only reachable by turning through this one.
 */
scenesRouter.delete('/:id/angles/:angleId', (req, res) => {
  const angle = db
    .prepare('SELECT * FROM scene_angles WHERE id = ? AND scene_id = ?')
    .get(req.params.angleId, req.params.id) as SceneAngleRow | undefined
  if (!angle) {
    res.status(404).json({ error: 'Angle not found on this scene' })
    return
  }

  const variantClause = angle.variant_id === null ? 'variant_id IS NULL' : 'variant_id = ?'
  const variantParams = angle.variant_id === null ? [] : [angle.variant_id]
  const comparison = angle.angle_offset > 0 ? 'angle_offset >= ?' : 'angle_offset <= ?'

  const orphaned = db
    .prepare(`SELECT * FROM scene_angles WHERE scene_id = ? AND ${variantClause} AND ${comparison}`)
    .all(req.params.id, ...variantParams, angle.angle_offset) as SceneAngleRow[]

  for (const row of orphaned) {
    deleteAngleDependents(req.params.id, row.variant_id, row.angle_offset)
    db.prepare('DELETE FROM scene_angles WHERE id = ?').run(row.id)
  }

  res.json({ removedOffsets: orphaned.map((row) => row.angle_offset) })
})

scenesRouter.post('/', (req, res) => {
  const { worldId, name, imageUrl, canvasX, canvasY } = req.body as {
    worldId?: string
    name?: string
    imageUrl?: string
    canvasX?: number
    canvasY?: number
  }
  if (!worldId || !name || !imageUrl) {
    res.status(400).json({ error: 'worldId, name and imageUrl are required' })
    return
  }

  const world = db.prepare('SELECT id FROM worlds WHERE id = ?').get(worldId)
  if (!world) {
    res.status(404).json({ error: 'World not found' })
    return
  }

  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    'INSERT INTO scenes (id, world_id, name, image_url, created_at, canvas_x, canvas_y) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, worldId, name, imageUrl, now, canvasX ?? null, canvasY ?? null)

  const row = db.prepare('SELECT * FROM scenes WHERE id = ?').get(id) as SceneRow
  res.status(201).json(toScene(row))
})

/** Swap the image behind a scene. The old image becomes unused and reappears in pickers. */
scenesRouter.patch('/:id/image', (req, res) => {
  const { imageUrl } = req.body as { imageUrl?: string }
  if (!imageUrl) {
    res.status(400).json({ error: 'imageUrl is required' })
    return
  }

  const scene = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id) as SceneRow | undefined
  if (!scene) {
    res.status(404).json({ error: 'Scene not found' })
    return
  }

  db.prepare('UPDATE scenes SET image_url = ? WHERE id = ?').run(imageUrl, req.params.id)
  const row = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id) as SceneRow
  res.json(toScene(row))
})

/** Same swap, but for one of the scene's options. */
scenesRouter.patch('/:id/variants/:variantId/image', (req, res) => {
  const { imageUrl } = req.body as { imageUrl?: string }
  if (!imageUrl) {
    res.status(400).json({ error: 'imageUrl is required' })
    return
  }

  const variant = db
    .prepare('SELECT * FROM scene_variants WHERE id = ? AND scene_id = ?')
    .get(req.params.variantId, req.params.id) as SceneVariantRow | undefined
  if (!variant) {
    res.status(404).json({ error: 'Variant not found on this scene' })
    return
  }

  db.prepare('UPDATE scene_variants SET image_url = ? WHERE id = ?').run(imageUrl, req.params.variantId)
  const row = db.prepare('SELECT * FROM scene_variants WHERE id = ?').get(req.params.variantId) as SceneVariantRow
  res.json(toSceneVariant(row))
})

scenesRouter.patch('/:id/position', (req, res) => {
  const { canvasX, canvasY } = req.body as { canvasX?: number; canvasY?: number }
  const existing = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id) as SceneRow | undefined
  if (!existing) {
    res.status(404).json({ error: 'Scene not found' })
    return
  }

  db.prepare('UPDATE scenes SET canvas_x = ?, canvas_y = ? WHERE id = ?').run(
    canvasX ?? existing.canvas_x,
    canvasY ?? existing.canvas_y,
    req.params.id,
  )

  const row = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id) as SceneRow
  res.json(toScene(row))
})

scenesRouter.post('/:id/links', (req, res) => {
  const { label, imageUrl, positionX, positionY } = req.body as {
    label?: string
    imageUrl?: string
    positionX?: number
    positionY?: number
  }
  if (!label || !imageUrl) {
    res.status(400).json({ error: 'label and imageUrl are required' })
    return
  }

  const originRow = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id) as SceneRow | undefined
  if (!originRow) {
    res.status(404).json({ error: 'Origin scene not found' })
    return
  }

  const now = new Date().toISOString()

  const targetId = randomUUID()
  db.prepare('INSERT INTO scenes (id, world_id, name, image_url, created_at) VALUES (?, ?, ?, ?, ?)').run(
    targetId,
    originRow.world_id,
    label,
    imageUrl,
    now,
  )

  const forwardId = randomUUID()
  db.prepare(`
    INSERT INTO scene_links (id, from_scene_id, to_scene_id, label, position_x, position_y, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(forwardId, originRow.id, targetId, label, positionX ?? 50, positionY ?? 50, now)

  const backwardId = randomUUID()
  db.prepare(`
    INSERT INTO scene_links (id, from_scene_id, to_scene_id, label, position_x, position_y, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(backwardId, targetId, originRow.id, originRow.name, 50, 50, now)

  const targetRow = db.prepare('SELECT * FROM scenes WHERE id = ?').get(targetId) as SceneRow
  const forwardRow = db.prepare('SELECT * FROM scene_links WHERE id = ?').get(forwardId) as SceneLinkRow

  res.status(201).json({
    scene: toScene(targetRow),
    link: toSceneLink(forwardRow),
  })
})

scenesRouter.post('/:id/connect', (req, res) => {
  const { targetSceneId, label } = req.body as { targetSceneId?: string; label?: string }
  if (!targetSceneId || !label) {
    res.status(400).json({ error: 'targetSceneId and label are required' })
    return
  }
  if (targetSceneId === req.params.id) {
    res.status(400).json({ error: 'Cannot connect a scene to itself' })
    return
  }

  const originRow = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id) as SceneRow | undefined
  const targetRow = db.prepare('SELECT * FROM scenes WHERE id = ?').get(targetSceneId) as SceneRow | undefined
  if (!originRow || !targetRow) {
    res.status(404).json({ error: 'Scene not found' })
    return
  }

  const now = new Date().toISOString()

  const forwardId = randomUUID()
  db.prepare(`
    INSERT INTO scene_links (id, from_scene_id, to_scene_id, label, position_x, position_y, created_at)
    VALUES (?, ?, ?, ?, 50, 50, ?)
  `).run(forwardId, originRow.id, targetRow.id, label, now)

  const backwardId = randomUUID()
  db.prepare(`
    INSERT INTO scene_links (id, from_scene_id, to_scene_id, label, position_x, position_y, created_at)
    VALUES (?, ?, ?, ?, 50, 50, ?)
  `).run(backwardId, targetRow.id, originRow.id, originRow.name, now)

  const forwardRow = db.prepare('SELECT * FROM scene_links WHERE id = ?').get(forwardId) as SceneLinkRow
  const backwardRow = db.prepare('SELECT * FROM scene_links WHERE id = ?').get(backwardId) as SceneLinkRow

  res.status(201).json({
    forwardLink: toSceneLink(forwardRow),
    backwardLink: toSceneLink(backwardRow),
  })
})

/**
 * Move a link's pin. Without `variantId`/`angleOffset` — or on the base option at angle 0
 * — this moves the link itself, which is where every view falls back to. On any other
 * angle it records a placement override for just that view.
 */
sceneLinksRouter.patch('/:id', (req, res) => {
  const { positionX, positionY, variantId, angleOffset } = req.body as {
    positionX?: number
    positionY?: number
    variantId?: string | null
    angleOffset?: number
  }
  const existing = db.prepare('SELECT * FROM scene_links WHERE id = ?').get(req.params.id) as
    | SceneLinkRow
    | undefined
  if (!existing) {
    res.status(404).json({ error: 'Scene link not found' })
    return
  }

  const offset = parseAngleOffset(angleOffset)
  if (offset === null) {
    res.status(400).json({ error: 'angleOffset must be an integer' })
    return
  }
  const targetVariant = toVariantId(variantId)

  if (targetVariant === null && offset === 0) {
    const nextX = positionX ?? existing.position_x
    const nextY = positionY ?? existing.position_y
    db.prepare('UPDATE scene_links SET position_x = ?, position_y = ? WHERE id = ?').run(
      nextX,
      nextY,
      req.params.id,
    )

    const row = db.prepare('SELECT * FROM scene_links WHERE id = ?').get(req.params.id) as SceneLinkRow
    res.json({ ...toSceneLink(row), anglePositions: loadLinkAnglePositions(req.params.id) })
    return
  }

  const variantClause = targetVariant === null ? 'variant_id IS NULL' : 'variant_id = ?'
  const variantParams = targetVariant === null ? [] : [targetVariant]
  const current = db
    .prepare(`SELECT * FROM scene_link_angles WHERE link_id = ? AND ${variantClause} AND angle_offset = ?`)
    .get(req.params.id, ...variantParams, offset) as SceneLinkAngleRow | undefined

  const nextX = positionX ?? current?.position_x ?? existing.position_x
  const nextY = positionY ?? current?.position_y ?? existing.position_y

  if (current) {
    db.prepare(
      `UPDATE scene_link_angles SET position_x = ?, position_y = ?
       WHERE link_id = ? AND ${variantClause} AND angle_offset = ?`,
    ).run(nextX, nextY, req.params.id, ...variantParams, offset)
  } else {
    db.prepare(`
      INSERT INTO scene_link_angles (link_id, variant_id, angle_offset, position_x, position_y)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.params.id, targetVariant, offset, nextX, nextY)
  }

  res.json({ ...toSceneLink(existing), anglePositions: loadLinkAnglePositions(req.params.id) })
})

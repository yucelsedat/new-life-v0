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
  heading: number
  magnetic: number
}

interface SceneLinkRow {
  id: string
  from_scene_id: string
  to_scene_id: string
  label: string
  position_x: number
  position_y: number
  angle_offset: number
  created_at: string
}

interface SceneVariantRow {
  id: string
  scene_id: string
  image_url: string
  option_index: number
  created_at: string
}

function toSceneVariant(row: SceneVariantRow) {
  return {
    id: row.id,
    sceneId: row.scene_id,
    imageUrl: row.image_url,
    optionIndex: row.option_index,
    createdAt: row.created_at,
  }
}

function loadVariants(sceneId: string) {
  const rows = db
    .prepare('SELECT * FROM scene_variants WHERE scene_id = ? ORDER BY option_index ASC')
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

/** A heading is whole degrees clockwise from 12 o'clock, so 0 up to but not including 360. */
function parseHeading(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  return value >= 0 && value < 360 ? value : null
}

interface SceneAngleRow {
  id: string
  scene_id: string
  variant_id: string | null
  angle_offset: number
  image_url: string
  created_at: string
  /** Null on angles from before headings existed, until the author sets one. */
  heading: number | null
  magnetic: number
}

function toSceneAngle(row: SceneAngleRow) {
  return {
    id: row.id,
    sceneId: row.scene_id,
    variantId: row.variant_id,
    offset: row.angle_offset,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    heading: row.heading,
    magnetic: row.magnetic === 1,
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
    heading: row.heading,
    magnetic: row.magnetic === 1,
  }
}

/**
 * Whether another image already looks that way. Within one option every image faces its
 * own direction — two hands on the same mark could not be told apart. The scene's own
 * image is the front of every option, so `variantId` undefined checks it against all of
 * the scene's angles; otherwise the check stays inside that one option.
 */
function headingTaken(
  scene: SceneRow,
  variantId: string | null | undefined,
  heading: number,
  exceptAngleId?: string,
): boolean {
  if (variantId !== undefined && scene.heading === heading) return true

  const variantClause =
    variantId === undefined ? '' : variantId === null ? 'AND variant_id IS NULL' : 'AND variant_id = ?'
  const variantParams = variantId ? [variantId] : []
  const clash = db
    .prepare(`SELECT id FROM scene_angles WHERE scene_id = ? ${variantClause} AND heading = ? AND id IS NOT ?`)
    .get(scene.id, ...variantParams, heading, exceptAngleId ?? null)
  return clash !== undefined
}

function toSceneLink(row: SceneLinkRow) {
  return {
    id: row.id,
    fromSceneId: row.from_scene_id,
    toSceneId: row.to_scene_id,
    label: row.label,
    positionX: row.position_x,
    positionY: row.position_y,
    angleOffset: row.angle_offset,
    createdAt: row.created_at,
  }
}

/** A scene's links as the editor and the game read them: target name and placements included. */
function loadLinks(sceneId: string) {
  const linkRows = db.prepare('SELECT * FROM scene_links WHERE from_scene_id = ?').all(sceneId) as SceneLinkRow[]

  return linkRows.map((linkRow) => {
    const targetScene = db.prepare('SELECT * FROM scenes WHERE id = ?').get(linkRow.to_scene_id) as
      | SceneRow
      | undefined
    return {
      ...toSceneLink(linkRow),
      toSceneName: targetScene?.name ?? null,
      anglePositions: loadLinkAnglePositions(linkRow.id),
    }
  })
}

/**
 * Every angle a link can sit on: the option image (0) and any offset at least one
 * option has an angle for. A link belongs to an angle across all options, so an offset
 * only one option has turned to still counts.
 */
function sceneOffsets(sceneId: string): number[] {
  const rows = db
    .prepare('SELECT DISTINCT angle_offset FROM scene_angles WHERE scene_id = ?')
    .all(sceneId) as { angle_offset: number }[]
  return [0, ...rows.map((row) => row.angle_offset).filter((offset) => offset !== 0)]
}

function linkAt(sceneId: string, angleOffset: number, exceptLinkId?: string) {
  return db
    .prepare('SELECT id FROM scene_links WHERE from_scene_id = ? AND angle_offset = ? AND id IS NOT ?')
    .get(sceneId, angleOffset, exceptLinkId ?? null) as { id: string } | undefined
}

/** Every view of a scene that holds no exit yet. */
function freeOffsets(sceneId: string): number[] {
  return sceneOffsets(sceneId).filter((offset) => !linkAt(sceneId, offset))
}

/** The option image if it has no exit yet, else the first free angle; null when every view is taken. */
function firstFreeOffset(sceneId: string): number | null {
  return freeOffsets(sceneId).sort((a, b) => Math.abs(a) - Math.abs(b) || b - a)[0] ?? null
}

/**
 * A link whose angle no option has any more cannot be seen or reached, so it falls back
 * to the option image — even if that already holds an exit, since losing the link
 * silently would be worse. The author can move it on from there.
 */
function rehomeStrandedLinks(sceneId: string) {
  const offsets = sceneOffsets(sceneId)
  db.prepare(
    `UPDATE scene_links SET angle_offset = 0
     WHERE from_scene_id = ? AND angle_offset NOT IN (${offsets.map(() => '?').join(',')})`,
  ).run(sceneId, ...offsets)
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
    // The canvas draws each scene as its angle ring and edits it from there, so its
    // angles, options and stories come along.
    scenes: sceneRows.map((row) => ({
      ...toScene(row),
      angles: loadAngles(row.id),
      variants: loadVariants(row.id),
      stories: loadStories(row.id),
    })),
    links: linkRows.map(toSceneLink),
  })
})

scenesRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id) as SceneRow | undefined
  if (!row) {
    res.status(404).json({ error: 'Scene not found' })
    return
  }

  res.json({
    ...toScene(row),
    links: loadLinks(row.id),
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

  // An option is the scene one step further along the world's clock, so it lands at the
  // end of this scene's chain — and shares that index's activation time with every
  // other scene's option of the same index.
  const highest = db
    .prepare('SELECT MAX(option_index) AS highest FROM scene_variants WHERE scene_id = ?')
    .get(req.params.id) as { highest: number | null }

  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    'INSERT INTO scene_variants (id, scene_id, image_url, option_index, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, req.params.id, imageUrl, (highest.highest ?? 0) + 1, now)

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
  rehomeStrandedLinks(req.params.id)

  // Indices address a moment on the world clock, so a hole would strand every later
  // option one step behind the rest of the world — close it.
  db.prepare(
    'UPDATE scene_variants SET option_index = option_index - 1 WHERE scene_id = ? AND option_index > ?',
  ).run(req.params.id, existing.option_index)

  res.status(204).end()
})

/**
 * The slot a new angle takes. A slot is what stories and links hang off, and one slot is
 * the same view in every option — so an angle looking the way another option's angle
 * already looks joins that slot and shares its link. Otherwise it gets a slot no option
 * of the scene has used.
 */
function slotFor(sceneId: string, variantId: string | null, heading: number): number {
  const rows = db
    .prepare('SELECT variant_id, angle_offset, heading FROM scene_angles WHERE scene_id = ?')
    .all(sceneId) as Pick<SceneAngleRow, 'variant_id' | 'angle_offset' | 'heading'>[]

  const own = new Set(rows.filter((row) => row.variant_id === variantId).map((row) => row.angle_offset))
  const twin = rows.find((row) => row.heading === heading && !own.has(row.angle_offset))
  if (twin) return twin.angle_offset

  const used = new Set(rows.map((row) => row.angle_offset))
  let slot = 1
  while (used.has(slot)) slot++
  return slot
}

/**
 * Add a viewing angle to one option. `heading` is the way it looks, as a hand on the
 * scene's ring, and is all that places it: turning goes round the ring from hand to hand.
 */
scenesRouter.post('/:id/angles', (req, res) => {
  const { variantId, imageUrl, heading, magnetic } = req.body as {
    variantId?: string | null
    imageUrl?: string
    heading?: number
    magnetic?: boolean
  }

  if (!imageUrl) {
    res.status(400).json({ error: 'imageUrl is required' })
    return
  }
  // An angle is a direction to look in, so it cannot be added without one.
  const angleHeading = parseHeading(heading)
  if (angleHeading === null) {
    res.status(400).json({ error: 'heading must be whole degrees from 0 to 359' })
    return
  }

  const scene = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id) as SceneRow | undefined
  if (!scene) {
    res.status(404).json({ error: 'Scene not found' })
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
  if (headingTaken(scene, targetVariant, angleHeading)) {
    res.status(409).json({ error: 'Another image of this option already looks that way' })
    return
  }

  const id = randomUUID()
  const offset = slotFor(req.params.id, targetVariant, angleHeading)
  db.prepare(`
    INSERT INTO scene_angles (id, scene_id, variant_id, angle_offset, image_url, created_at, heading, magnetic)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.params.id,
    targetVariant,
    offset,
    imageUrl,
    new Date().toISOString(),
    angleHeading,
    magnetic === true ? 1 : 0,
  )

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

/** Turn one angle's hand: which way its image looks. */
scenesRouter.patch('/:id/angles/:angleId/heading', (req, res) => {
  const heading = parseHeading((req.body as { heading?: number }).heading)
  if (heading === null) {
    res.status(400).json({ error: 'heading must be whole degrees from 0 to 359' })
    return
  }

  const scene = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id) as SceneRow | undefined
  const angle = db
    .prepare('SELECT * FROM scene_angles WHERE id = ? AND scene_id = ?')
    .get(req.params.angleId, req.params.id) as SceneAngleRow | undefined
  if (!scene || !angle) {
    res.status(404).json({ error: 'Angle not found on this scene' })
    return
  }
  if (headingTaken(scene, angle.variant_id, heading, angle.id)) {
    res.status(409).json({ error: 'Another image of this option already looks that way' })
    return
  }

  db.prepare('UPDATE scene_angles SET heading = ? WHERE id = ?').run(heading, req.params.angleId)
  const row = db.prepare('SELECT * FROM scene_angles WHERE id = ?').get(req.params.angleId) as SceneAngleRow
  res.json(toSceneAngle(row))
})

/** Make one angle magnetic, or plain again. */
scenesRouter.patch('/:id/angles/:angleId/magnetic', (req, res) => {
  const { magnetic } = req.body as { magnetic?: boolean }
  if (typeof magnetic !== 'boolean') {
    res.status(400).json({ error: 'magnetic must be true or false' })
    return
  }

  const angle = db
    .prepare('SELECT * FROM scene_angles WHERE id = ? AND scene_id = ?')
    .get(req.params.angleId, req.params.id) as SceneAngleRow | undefined
  if (!angle) {
    res.status(404).json({ error: 'Angle not found on this scene' })
    return
  }

  db.prepare('UPDATE scene_angles SET magnetic = ? WHERE id = ?').run(magnetic ? 1 : 0, req.params.angleId)
  const row = db.prepare('SELECT * FROM scene_angles WHERE id = ?').get(req.params.angleId) as SceneAngleRow
  res.json(toSceneAngle(row))
})

/**
 * Remove an angle, with the story and link placements that hang off it. The other angles
 * stay: each is reached by turning round the ring, not by passing through this one.
 */
scenesRouter.delete('/:id/angles/:angleId', (req, res) => {
  const angle = db
    .prepare('SELECT * FROM scene_angles WHERE id = ? AND scene_id = ?')
    .get(req.params.angleId, req.params.id) as SceneAngleRow | undefined
  if (!angle) {
    res.status(404).json({ error: 'Angle not found on this scene' })
    return
  }

  deleteAngleDependents(req.params.id, angle.variant_id, angle.angle_offset)
  db.prepare('DELETE FROM scene_angles WHERE id = ?').run(angle.id)
  rehomeStrandedLinks(req.params.id)

  res.json({ removedOffsets: [angle.angle_offset], links: loadLinks(req.params.id) })
})

scenesRouter.post('/', (req, res) => {
  const { worldId, name, imageUrl, canvasX, canvasY, heading, magnetic } = req.body as {
    worldId?: string
    name?: string
    imageUrl?: string
    canvasX?: number
    canvasY?: number
    heading?: number
    magnetic?: boolean
  }
  if (!worldId || !name || !imageUrl) {
    res.status(400).json({ error: 'worldId, name and imageUrl are required' })
    return
  }
  // Left out, the scene's image faces 12 o'clock.
  const sceneHeading = heading === undefined ? 0 : parseHeading(heading)
  if (sceneHeading === null) {
    res.status(400).json({ error: 'heading must be whole degrees from 0 to 359' })
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
    `INSERT INTO scenes (id, world_id, name, image_url, created_at, canvas_x, canvas_y, heading, magnetic)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, worldId, name, imageUrl, now, canvasX ?? null, canvasY ?? null, sceneHeading, magnetic === true ? 1 : 0)

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

/** Turn the scene's own hand: which way its image, and every option's image, looks. */
scenesRouter.patch('/:id/heading', (req, res) => {
  const heading = parseHeading((req.body as { heading?: number }).heading)
  if (heading === null) {
    res.status(400).json({ error: 'heading must be whole degrees from 0 to 359' })
    return
  }

  const scene = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id) as SceneRow | undefined
  if (!scene) {
    res.status(404).json({ error: 'Scene not found' })
    return
  }
  if (headingTaken(scene, undefined, heading)) {
    res.status(409).json({ error: "One of this scene's angles already looks that way" })
    return
  }

  db.prepare('UPDATE scenes SET heading = ? WHERE id = ?').run(heading, req.params.id)
  const row = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id) as SceneRow
  res.json(toScene(row))
})

/** Make the scene's own image magnetic, or plain again — in every option. */
scenesRouter.patch('/:id/magnetic', (req, res) => {
  const { magnetic } = req.body as { magnetic?: boolean }
  if (typeof magnetic !== 'boolean') {
    res.status(400).json({ error: 'magnetic must be true or false' })
    return
  }

  const scene = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id) as SceneRow | undefined
  if (!scene) {
    res.status(404).json({ error: 'Scene not found' })
    return
  }

  db.prepare('UPDATE scenes SET magnetic = ? WHERE id = ?').run(magnetic ? 1 : 0, req.params.id)
  const row = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id) as SceneRow
  res.json(toScene(row))
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

/**
 * Create a new scene and link to it from one view of this one. `angleOffset` omitted
 * means the option image. Each view holds at most one exit, so a taken view is refused.
 */
scenesRouter.post('/:id/links', (req, res) => {
  const { label, imageUrl, positionX, positionY, angleOffset, heading, magnetic } = req.body as {
    label?: string
    imageUrl?: string
    positionX?: number
    positionY?: number
    angleOffset?: number
    heading?: number
    magnetic?: boolean
  }
  if (!label || !imageUrl) {
    res.status(400).json({ error: 'label and imageUrl are required' })
    return
  }
  // The heading and the magnet are the new scene's, not this one's. Left out, it faces
  // 12 o'clock and is plain.
  const targetHeading = heading === undefined ? 0 : parseHeading(heading)
  if (targetHeading === null) {
    res.status(400).json({ error: 'heading must be whole degrees from 0 to 359' })
    return
  }

  const originRow = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id) as SceneRow | undefined
  if (!originRow) {
    res.status(404).json({ error: 'Origin scene not found' })
    return
  }

  const offset = parseAngleOffset(angleOffset)
  if (offset === null) {
    res.status(400).json({ error: 'angleOffset must be an integer' })
    return
  }
  if (!sceneOffsets(originRow.id).includes(offset)) {
    res.status(404).json({ error: 'Angle not found on this scene' })
    return
  }
  if (linkAt(originRow.id, offset)) {
    res.status(409).json({ error: 'This view already has a scene link' })
    return
  }

  const now = new Date().toISOString()

  const targetId = randomUUID()
  db.prepare(
    'INSERT INTO scenes (id, world_id, name, image_url, created_at, heading, magnetic) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(targetId, originRow.world_id, label, imageUrl, now, targetHeading, magnetic === true ? 1 : 0)

  const forwardId = randomUUID()
  db.prepare(`
    INSERT INTO scene_links (id, from_scene_id, to_scene_id, label, position_x, position_y, angle_offset, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(forwardId, originRow.id, targetId, label, positionX ?? 50, positionY ?? 50, offset, now)

  // The new scene is empty, so the way back takes its option image.
  const backwardId = randomUUID()
  db.prepare(`
    INSERT INTO scene_links (id, from_scene_id, to_scene_id, label, position_x, position_y, angle_offset, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
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

  // Both ends need a free view to hang their exit on; the canvas has no view on screen,
  // so each takes its option image, or failing that its first free angle.
  const forwardOffset = firstFreeOffset(originRow.id)
  const backwardOffset = firstFreeOffset(targetRow.id)
  if (forwardOffset === null || backwardOffset === null) {
    res.status(409).json({ error: 'Every view of one of these scenes already has a scene link' })
    return
  }

  const now = new Date().toISOString()

  const forwardId = randomUUID()
  db.prepare(`
    INSERT INTO scene_links (id, from_scene_id, to_scene_id, label, position_x, position_y, angle_offset, created_at)
    VALUES (?, ?, ?, ?, 50, 50, ?, ?)
  `).run(forwardId, originRow.id, targetRow.id, label, forwardOffset, now)

  const backwardId = randomUUID()
  db.prepare(`
    INSERT INTO scene_links (id, from_scene_id, to_scene_id, label, position_x, position_y, angle_offset, created_at)
    VALUES (?, ?, ?, ?, 50, 50, ?, ?)
  `).run(backwardId, targetRow.id, originRow.id, originRow.name, backwardOffset, now)

  const forwardRow = db.prepare('SELECT * FROM scene_links WHERE id = ?').get(forwardId) as SceneLinkRow
  const backwardRow = db.prepare('SELECT * FROM scene_links WHERE id = ?').get(backwardId) as SceneLinkRow

  res.status(201).json({
    forwardLink: toSceneLink(forwardRow),
    backwardLink: toSceneLink(backwardRow),
  })
})

/**
 * Give `from` an exit to `to` unless it already has one: hung on a view picked at random
 * from those still free, and named after the scene it leads to. A scene whose every view
 * is taken is left as it is.
 */
function hangRandomLink(from: SceneRow, to: SceneRow, now: string) {
  const existing = db
    .prepare('SELECT id FROM scene_links WHERE from_scene_id = ? AND to_scene_id = ?')
    .get(from.id, to.id)
  if (existing) return { status: 'linked' as const, link: null }

  const free = freeOffsets(from.id)
  if (free.length === 0) return { status: 'full' as const, link: null }

  const id = randomUUID()
  db.prepare(`
    INSERT INTO scene_links (id, from_scene_id, to_scene_id, label, position_x, position_y, angle_offset, created_at)
    VALUES (?, ?, ?, ?, 50, 50, ?, ?)
  `).run(id, from.id, to.id, to.name, free[Math.floor(Math.random() * free.length)], now)

  const row = db.prepare('SELECT * FROM scene_links WHERE id = ?').get(id) as SceneLinkRow
  return { status: 'created' as const, link: toSceneLink(row) }
}

/**
 * Join two scenes without asking anything: each end that has no exit to the other yet
 * gets one on a random free view. The ends are settled apart, so a pair already joined
 * one way only gains the way back, and one end being full does not hold up the other.
 */
scenesRouter.post('/:id/connect/random', (req, res) => {
  const { targetSceneId } = req.body as { targetSceneId?: string }
  if (!targetSceneId) {
    res.status(400).json({ error: 'targetSceneId is required' })
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
  if (originRow.world_id !== targetRow.world_id) {
    res.status(400).json({ error: 'Scenes belong to different worlds' })
    return
  }

  const now = new Date().toISOString()
  const forward = hangRandomLink(originRow, targetRow, now)
  const backward = hangRandomLink(targetRow, originRow, now)

  res.status(forward.link || backward.link ? 201 : 200).json({ forward, backward })
})

/** Remove links for good, each with the pin placements it had. */
function deleteLinks(linkIds: string[]) {
  const placeholders = linkIds.map(() => '?').join(',')
  db.prepare(`DELETE FROM scene_link_angles WHERE link_id IN (${placeholders})`).run(...linkIds)
  db.prepare(`DELETE FROM scene_links WHERE id IN (${placeholders})`).run(...linkIds)
}

/**
 * Unjoin two scenes: every link between them goes, both ways, and with each the pin
 * placements it had. The scenes themselves and their other exits stay as they are.
 */
scenesRouter.delete('/:id/connect/:targetId', (req, res) => {
  const { id, targetId } = req.params
  const rows = db
    .prepare(
      `SELECT id FROM scene_links
       WHERE (from_scene_id = ? AND to_scene_id = ?) OR (from_scene_id = ? AND to_scene_id = ?)`,
    )
    .all(id, targetId, targetId, id) as { id: string }[]
  if (rows.length === 0) {
    res.status(404).json({ error: 'These scenes are not connected' })
    return
  }

  const linkIds = rows.map((row) => row.id)
  deleteLinks(linkIds)

  res.json({ removedLinkIds: linkIds })
})

/**
 * Link one view of this scene to a scene that already exists. One way only: the way back
 * is a link of its own, made — or left out — from the other scene. `label` omitted names
 * the link after the scene it leads to. Each view holds at most one exit, so a taken view
 * is refused.
 */
scenesRouter.post('/:id/links/existing', (req, res) => {
  const { targetSceneId, angleOffset, label } = req.body as {
    targetSceneId?: string
    angleOffset?: number
    label?: string
  }
  if (!targetSceneId) {
    res.status(400).json({ error: 'targetSceneId is required' })
    return
  }
  if (targetSceneId === req.params.id) {
    res.status(400).json({ error: 'Cannot link a scene to itself' })
    return
  }

  const originRow = db.prepare('SELECT * FROM scenes WHERE id = ?').get(req.params.id) as SceneRow | undefined
  const targetRow = db.prepare('SELECT * FROM scenes WHERE id = ?').get(targetSceneId) as SceneRow | undefined
  if (!originRow || !targetRow) {
    res.status(404).json({ error: 'Scene not found' })
    return
  }
  if (originRow.world_id !== targetRow.world_id) {
    res.status(400).json({ error: 'Scenes belong to different worlds' })
    return
  }

  const offset = parseAngleOffset(angleOffset)
  if (offset === null) {
    res.status(400).json({ error: 'angleOffset must be an integer' })
    return
  }
  if (!sceneOffsets(originRow.id).includes(offset)) {
    res.status(404).json({ error: 'Angle not found on this scene' })
    return
  }
  if (linkAt(originRow.id, offset)) {
    res.status(409).json({ error: 'This view already has a scene link' })
    return
  }

  const id = randomUUID()
  db.prepare(`
    INSERT INTO scene_links (id, from_scene_id, to_scene_id, label, position_x, position_y, angle_offset, created_at)
    VALUES (?, ?, ?, ?, 50, 50, ?, ?)
  `).run(id, originRow.id, targetRow.id, label?.trim() || targetRow.name, offset, new Date().toISOString())

  const row = db.prepare('SELECT * FROM scene_links WHERE id = ?').get(id) as SceneLinkRow
  res.status(201).json(toSceneLink(row))
})

/**
 * Move a link's pin. On the base option at the link's own angle this moves the link
 * itself, which is where every option falls back to. In any other option it records a
 * placement override for just that view.
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

  if (targetVariant === null && offset === existing.angle_offset) {
    const nextX = positionX ?? existing.position_x
    const nextY = positionY ?? existing.position_y
    db.prepare('UPDATE scene_links SET position_x = ?, position_y = ? WHERE id = ?').run(
      nextX,
      nextY,
      req.params.id,
    )
    // A placement left here from before the link moved would shadow the one just made.
    db.prepare('DELETE FROM scene_link_angles WHERE link_id = ? AND variant_id IS NULL AND angle_offset = ?').run(
      req.params.id,
      offset,
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

/**
 * Remove one link, and only that one: a link back from the scene it led to is another
 * link and stays, so the two scenes are then joined one way.
 */
sceneLinksRouter.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM scene_links WHERE id = ?').get(req.params.id)
  if (!existing) {
    res.status(404).json({ error: 'Scene link not found' })
    return
  }

  deleteLinks([req.params.id])
  res.json({ removedLinkIds: [req.params.id] })
})

/**
 * Hang a link on another view of its scene. The target view must exist on at least one
 * option and must not already hold an exit. Per-view pin placements are kept, so a link
 * moved back to a view it has been on before lands where it was left.
 */
sceneLinksRouter.patch('/:id/angle', (req, res) => {
  const { angleOffset } = req.body as { angleOffset?: number }
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
  if (!sceneOffsets(existing.from_scene_id).includes(offset)) {
    res.status(404).json({ error: 'Angle not found on this scene' })
    return
  }
  if (linkAt(existing.from_scene_id, offset, existing.id)) {
    res.status(409).json({ error: 'That view already has a scene link' })
    return
  }

  db.prepare('UPDATE scene_links SET angle_offset = ? WHERE id = ?').run(offset, req.params.id)
  const row = db.prepare('SELECT * FROM scene_links WHERE id = ?').get(req.params.id) as SceneLinkRow
  res.json({ ...toSceneLink(row), anglePositions: loadLinkAnglePositions(req.params.id) })
})

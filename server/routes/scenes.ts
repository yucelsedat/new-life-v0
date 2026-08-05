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
    return { ...toSceneLink(linkRow), toSceneName: targetScene?.name ?? null }
  })

  res.json({ ...toScene(row), links, variants: loadVariants(row.id) })
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

  db.prepare('DELETE FROM scene_variants WHERE id = ?').run(req.params.variantId)
  res.status(204).end()
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

sceneLinksRouter.patch('/:id', (req, res) => {
  const { positionX, positionY } = req.body as { positionX?: number; positionY?: number }
  const existing = db.prepare('SELECT * FROM scene_links WHERE id = ?').get(req.params.id) as
    | SceneLinkRow
    | undefined
  if (!existing) {
    res.status(404).json({ error: 'Scene link not found' })
    return
  }

  const nextX = positionX ?? existing.position_x
  const nextY = positionY ?? existing.position_y

  db.prepare('UPDATE scene_links SET position_x = ?, position_y = ? WHERE id = ?').run(
    nextX,
    nextY,
    req.params.id,
  )

  const row = db.prepare('SELECT * FROM scene_links WHERE id = ?').get(req.params.id) as SceneLinkRow
  res.json(toSceneLink(row))
})

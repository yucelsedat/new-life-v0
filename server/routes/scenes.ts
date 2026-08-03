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

function toScene(row: SceneRow) {
  return {
    id: row.id,
    worldId: row.world_id,
    name: row.name,
    imageUrl: row.image_url,
    createdAt: row.created_at,
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

  res.json({ ...toScene(row), links })
})

scenesRouter.post('/', (req, res) => {
  const { worldId, name, imageUrl } = req.body as { worldId?: string; name?: string; imageUrl?: string }
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
  db.prepare('INSERT INTO scenes (id, world_id, name, image_url, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    worldId,
    name,
    imageUrl,
    now,
  )

  const row = db.prepare('SELECT * FROM scenes WHERE id = ?').get(id) as SceneRow
  res.status(201).json(toScene(row))
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

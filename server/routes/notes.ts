import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { db } from '../db.ts'

export const notesRouter = Router()

interface NoteRow {
  id: string
  world_id: string
  title: string
  body: string
  done: number
  position: number
  created_at: string
  updated_at: string
}

function toNote(row: NoteRow) {
  return {
    id: row.id,
    worldId: row.world_id,
    title: row.title,
    body: row.body,
    done: row.done === 1,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Open notes first, then done ones — each group in the author's own ordering. */
const LIST_SQL = 'SELECT * FROM world_notes WHERE world_id = ? ORDER BY done ASC, position ASC'

notesRouter.get('/', (req, res) => {
  const worldId = req.query.worldId as string | undefined
  if (!worldId) {
    res.status(400).json({ error: 'worldId query parameter is required' })
    return
  }

  const rows = db.prepare(LIST_SQL).all(worldId) as NoteRow[]
  res.json(rows.map(toNote))
})

notesRouter.post('/', (req, res) => {
  const { worldId, title, body } = req.body as { worldId?: string; title?: string; body?: string }
  if (!worldId || !title?.trim()) {
    res.status(400).json({ error: 'worldId and a non-empty title are required' })
    return
  }

  const world = db.prepare('SELECT id FROM worlds WHERE id = ?').get(worldId)
  if (!world) {
    res.status(404).json({ error: 'World not found' })
    return
  }

  const maxPosition = db
    .prepare('SELECT MAX(position) as maxPosition FROM world_notes WHERE world_id = ?')
    .get(worldId) as { maxPosition: number | null }
  const now = new Date().toISOString()
  const id = randomUUID()

  db.prepare(`
    INSERT INTO world_notes (id, world_id, title, body, done, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?)
  `).run(id, worldId, title.trim(), body?.trim() ?? '', (maxPosition.maxPosition ?? 0) + 1, now, now)

  const row = db.prepare('SELECT * FROM world_notes WHERE id = ?').get(id) as NoteRow
  res.status(201).json(toNote(row))
})

notesRouter.patch('/:id', (req, res) => {
  const { title, body, done } = req.body as { title?: string; body?: string; done?: boolean }

  const existing = db.prepare('SELECT * FROM world_notes WHERE id = ?').get(req.params.id) as NoteRow | undefined
  if (!existing) {
    res.status(404).json({ error: 'Note not found' })
    return
  }

  if (title !== undefined && !title.trim()) {
    res.status(400).json({ error: 'title cannot be empty' })
    return
  }

  db.prepare('UPDATE world_notes SET title = ?, body = ?, done = ?, updated_at = ? WHERE id = ?').run(
    title?.trim() ?? existing.title,
    body !== undefined ? body.trim() : existing.body,
    done === undefined ? existing.done : done ? 1 : 0,
    new Date().toISOString(),
    req.params.id,
  )

  const row = db.prepare('SELECT * FROM world_notes WHERE id = ?').get(req.params.id) as NoteRow
  res.json(toNote(row))
})

/** Rewrites the manual ordering from a full list of this world's note ids. */
notesRouter.put('/reorder', (req, res) => {
  const { worldId, ids } = req.body as { worldId?: string; ids?: string[] }
  if (!worldId || !Array.isArray(ids)) {
    res.status(400).json({ error: 'worldId and ids are required' })
    return
  }

  const owned = new Set(
    (db.prepare('SELECT id FROM world_notes WHERE world_id = ?').all(worldId) as { id: string }[]).map(
      (row) => row.id,
    ),
  )
  if (ids.some((id) => !owned.has(id))) {
    res.status(400).json({ error: 'ids must all belong to this world' })
    return
  }

  const update = db.prepare('UPDATE world_notes SET position = ? WHERE id = ?')
  ids.forEach((id, index) => update.run(index + 1, id))

  const rows = db.prepare(LIST_SQL).all(worldId) as NoteRow[]
  res.json(rows.map(toNote))
})

notesRouter.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM world_notes WHERE id = ?').get(req.params.id)
  if (!existing) {
    res.status(404).json({ error: 'Note not found' })
    return
  }

  db.prepare('DELETE FROM world_notes WHERE id = ?').run(req.params.id)
  res.status(204).end()
})

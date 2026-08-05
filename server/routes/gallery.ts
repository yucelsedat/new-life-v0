import { Router } from 'express'
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, extname, join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { db } from '../db.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const uploadsDir = join(__dirname, '..', 'uploads')
mkdirSync(uploadsDir, { recursive: true })

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024
const MAX_FILES_PER_UPLOAD = 12

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
})

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES_PER_UPLOAD },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'))
      return
    }
    cb(null, true)
  },
})

export const galleryRouter = Router()

const IMAGE_KINDS = ['scene', 'character'] as const
type ImageKind = (typeof IMAGE_KINDS)[number]

function parseKind(value: unknown): ImageKind | null {
  return IMAGE_KINDS.includes(value as ImageKind) ? (value as ImageKind) : null
}

interface ImageRow {
  id: string
  filename: string
  original_name: string
  url: string
  size_bytes: number
  uploaded_at: string
  world_id: string | null
  kind: string
}

function toImage(row: ImageRow) {
  return {
    id: row.id,
    url: row.url,
    originalName: row.original_name,
    sizeBytes: row.size_bytes,
    uploadedAt: row.uploaded_at,
    worldId: row.world_id,
    kind: row.kind,
  }
}

/**
 * Scope rules:
 *   ?worldId=<id>  -> images belonging to that world
 *   ?worldId=global -> the global library (world_id IS NULL)
 *   (omitted)      -> every image
 * ?kind=scene|character narrows further.
 */
galleryRouter.get('/', (req, res) => {
  const worldId = req.query.worldId as string | undefined
  const kind = req.query.kind as string | undefined

  const clauses: string[] = []
  const params: (string | null)[] = []

  if (worldId === 'global') {
    clauses.push('world_id IS NULL')
  } else if (worldId) {
    clauses.push('world_id = ?')
    params.push(worldId)
  }

  if (kind) {
    if (!parseKind(kind)) {
      res.status(400).json({ error: `kind must be one of: ${IMAGE_KINDS.join(', ')}` })
      return
    }
    clauses.push('kind = ?')
    params.push(kind)
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = db
    .prepare(`SELECT * FROM images ${where} ORDER BY uploaded_at DESC`)
    .all(...params) as ImageRow[]
  res.json(rows.map(toImage))
})

galleryRouter.post('/', (req, res) => {
  upload.array('images', MAX_FILES_PER_UPLOAD)(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' })
      return
    }

    const files = req.files as Express.Multer.File[] | undefined
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No image files provided' })
      return
    }

    // Multipart text fields arrive alongside the files.
    const body = req.body as { worldId?: string; kind?: string }
    const kind = parseKind(body.kind) ?? 'character'
    const worldId = body.worldId && body.worldId !== 'global' ? body.worldId : null

    if (worldId) {
      const world = db.prepare('SELECT id FROM worlds WHERE id = ?').get(worldId)
      if (!world) {
        res.status(404).json({ error: 'World not found' })
        return
      }
    }

    const insert = db.prepare(`
      INSERT INTO images (id, filename, original_name, url, size_bytes, uploaded_at, world_id, kind)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const now = new Date().toISOString()
    const created = files.map((file) => {
      const id = randomUUID()
      const url = `/uploads/${file.filename}`
      insert.run(id, file.filename, file.originalname, url, file.size, now, worldId, kind)
      return toImage({
        id,
        filename: file.filename,
        original_name: file.originalname,
        url,
        size_bytes: file.size,
        uploaded_at: now,
        world_id: worldId,
        kind,
      })
    })

    res.status(201).json(created)
  })
})

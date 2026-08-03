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

interface ImageRow {
  id: string
  filename: string
  original_name: string
  url: string
  size_bytes: number
  uploaded_at: string
}

function toImage(row: ImageRow) {
  return {
    id: row.id,
    url: row.url,
    originalName: row.original_name,
    sizeBytes: row.size_bytes,
    uploadedAt: row.uploaded_at,
  }
}

galleryRouter.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM images ORDER BY uploaded_at DESC').all() as ImageRow[]
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

    const insert = db.prepare(`
      INSERT INTO images (id, filename, original_name, url, size_bytes, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const now = new Date().toISOString()
    const created = files.map((file) => {
      const id = randomUUID()
      const url = `/uploads/${file.filename}`
      insert.run(id, file.filename, file.originalname, url, file.size, now)
      return toImage({
        id,
        filename: file.filename,
        original_name: file.originalname,
        url,
        size_bytes: file.size,
        uploaded_at: now,
      })
    })

    res.status(201).json(created)
  })
})

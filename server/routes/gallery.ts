import { Router } from 'express'
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, extname, join } from 'node:path'
import { mkdirSync, rmSync } from 'node:fs'
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

function toImage(row: ImageRow, inUse = false) {
  return {
    id: row.id,
    url: row.url,
    originalName: row.original_name,
    sizeBytes: row.size_bytes,
    uploadedAt: row.uploaded_at,
    worldId: row.world_id,
    kind: row.kind,
    inUse,
  }
}

/**
 * Every place an image URL can be consumed. One definition serves both the `inUse`
 * flag the library shows and the deletion guard — a used image must never be removed.
 * `urlExpr` is the SQL expression holding the URL: a named parameter when checking one
 * image, or `images.url` when correlating with the row being listed. `worldExpr`, given
 * the same way, counts only what that one world consumes.
 */
function imageUsageSql(urlExpr: ':url' | 'images.url', worldExpr?: ':world' | 'images.world_id'): string {
  const ofWorld = worldExpr ? ` AND scene_id IN (SELECT id FROM scenes WHERE world_id = ${worldExpr})` : ''
  return `
    SELECT 1 FROM scenes WHERE image_url = ${urlExpr}${worldExpr ? ` AND world_id = ${worldExpr}` : ''}
    UNION ALL
    SELECT 1 FROM scene_variants WHERE image_url = ${urlExpr}${ofWorld}
    UNION ALL
    SELECT 1 FROM scene_angles WHERE image_url = ${urlExpr}${ofWorld}
    UNION ALL
    SELECT 1 FROM story_frames WHERE image_url = ${urlExpr}${ofWorld}
    UNION ALL
    SELECT 1 FROM worlds WHERE scene_image_url = ${urlExpr}${worldExpr ? ` AND id = ${worldExpr}` : ''}
  `
}

/**
 * Whether the record being listed is in use. A world's image answers for that world
 * alone: a duplicated world has its own records for the files it shares with its source,
 * and what the source still shows must not pin an image the copy has let go of. An image
 * of the global library belongs to no world, so any use anywhere counts.
 */
const LISTED_IMAGE_IN_USE_SQL = `
  CASE WHEN images.world_id IS NULL
    THEN EXISTS(${imageUsageSql('images.url')})
    ELSE EXISTS(${imageUsageSql('images.url', 'images.world_id')})
  END
`

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
    .prepare(
      `SELECT images.*, ${LISTED_IMAGE_IN_USE_SQL} AS in_use
       FROM images ${where} ORDER BY uploaded_at DESC`,
    )
    .all(...params) as (ImageRow & { in_use: number })[]
  res.json(rows.map((row) => toImage(row, row.in_use === 1)))
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

// Parameters are named, so adding a new place an image can be used never silently
// breaks the binding.
function isUrlInUse(url: string): boolean {
  return db.prepare(`${imageUsageSql(':url')} LIMIT 1`).get({ url }) !== undefined
}

/** The single-record form of the listing's rule: a world's image answers for its own world. */
function isImageInUse(image: Pick<ImageRow, 'url' | 'world_id'>): boolean {
  if (image.world_id === null) return isUrlInUse(image.url)
  const hit = db.prepare(`${imageUsageSql(':url', ':world')} LIMIT 1`).get({ url: image.url, world: image.world_id })
  return hit !== undefined
}

/**
 * Bulk delete. Images still referenced by a scene, option, angle, story frame or world cover
 * are left untouched and reported back as `skipped` — deleting them would leave
 * dangling image URLs in the game.
 */
galleryRouter.delete('/', (req, res) => {
  const { ids } = req.body as { ids?: unknown }
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string')) {
    res.status(400).json({ error: 'ids must be a non-empty array of image ids' })
    return
  }

  const placeholders = ids.map(() => '?').join(',')
  const rows = db
    .prepare(`SELECT id, filename, original_name, url, world_id FROM images WHERE id IN (${placeholders})`)
    .all(...(ids as string[])) as Pick<ImageRow, 'id' | 'filename' | 'original_name' | 'url' | 'world_id'>[]

  const inUseIds = new Set(rows.filter(isImageInUse).map((row) => row.id))
  const deletable = rows.filter((row) => !inUseIds.has(row.id))
  const skipped = rows
    .filter((row) => inUseIds.has(row.id))
    .map((row) => ({ id: row.id, originalName: row.original_name }))

  if (deletable.length) {
    const deletePlaceholders = deletable.map(() => '?').join(',')
    db.prepare(`DELETE FROM images WHERE id IN (${deletePlaceholders})`).run(...deletable.map((row) => row.id))
  }

  // The same upload can back several image records (another world, the global library),
  // so a file only goes once nothing points at it anymore — neither a record nor,
  // should a world show an image it holds no record for, the game itself.
  const stillReferenced = db.prepare('SELECT 1 FROM images WHERE filename = ? LIMIT 1')
  for (const row of deletable) {
    if (stillReferenced.get(row.filename) || isUrlInUse(row.url)) continue
    try {
      rmSync(join(uploadsDir, row.filename))
    } catch {
      // file already gone — the database record is what matters
    }
  }

  res.json({ deleted: deletable.map((row) => row.id), skipped })
})

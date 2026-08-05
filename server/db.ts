import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, 'data')
mkdirSync(dataDir, { recursive: true })

export const db = new DatabaseSync(join(dataDir, 'new-life.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS worlds (
    id TEXT PRIMARY KEY,
    slot INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    scene_id TEXT NOT NULL,
    scene_label TEXT NOT NULL,
    scene_image_url TEXT,
    progress REAL NOT NULL DEFAULT 0,
    play_time_minutes INTEGER NOT NULL DEFAULT 0,
    last_played_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS profile (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    avatar_seed TEXT NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    is_premium INTEGER NOT NULL DEFAULT 0,
    unread_notifications INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    url TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    uploaded_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scenes (
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scene_links (
    id TEXT PRIMARY KEY,
    from_scene_id TEXT NOT NULL,
    to_scene_id TEXT NOT NULL,
    label TEXT NOT NULL,
    position_x REAL NOT NULL DEFAULT 50,
    position_y REAL NOT NULL DEFAULT 50,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scene_variants (
    id TEXT PRIMARY KEY,
    scene_id TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`)

for (const column of ['canvas_x', 'canvas_y']) {
  try {
    db.exec(`ALTER TABLE scenes ADD COLUMN ${column} REAL`)
  } catch {
    // column already exists
  }
}

// Images gained a scope (which world they belong to) and a kind (scene artwork vs character).
// NULL world_id means the image lives in the global character library.
let imagesJustScoped = false
try {
  db.exec(`ALTER TABLE images ADD COLUMN world_id TEXT`)
  imagesJustScoped = true
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE images ADD COLUMN kind TEXT NOT NULL DEFAULT 'character'`)
} catch {
  // column already exists
}

if (imagesJustScoped) {
  // Back-fill: any image already used as a scene background or scene variant demonstrably
  // belongs to that scene's world, so scope it there and mark it as scene artwork.
  db.exec(`
    UPDATE images SET kind = 'scene', world_id = (
      SELECT s.world_id FROM scenes s WHERE s.image_url = images.url LIMIT 1
    )
    WHERE url IN (SELECT image_url FROM scenes);

    UPDATE images SET kind = 'scene', world_id = (
      SELECT s.world_id FROM scenes s
      JOIN scene_variants v ON v.scene_id = s.id
      WHERE v.image_url = images.url LIMIT 1
    )
    WHERE url IN (SELECT image_url FROM scene_variants);
  `)
}

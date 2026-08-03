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
`)

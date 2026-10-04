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

  -- An ordered image sequence attached to one option of a scene.
  -- variant_id NULL means the story belongs to the scene's base image.
  CREATE TABLE IF NOT EXISTS story_frames (
    id TEXT PRIMARY KEY,
    scene_id TEXT NOT NULL,
    variant_id TEXT,
    image_url TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  -- A different viewing direction of one option of a scene — still the same scene,
  -- so it can hold one of that scene's links. angle_offset is the slot stories and links
  -- hang off: 0 is the option image itself (never stored here), and one slot is the same
  -- view in every option. Which way the angle looks, and so where it comes round when
  -- turning, is its heading — the number of the slot says nothing about direction.
  CREATE TABLE IF NOT EXISTS scene_angles (
    id TEXT PRIMARY KEY,
    scene_id TEXT NOT NULL,
    variant_id TEXT,
    angle_offset INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS scene_angles_slot
    ON scene_angles (scene_id, IFNULL(variant_id, ''), angle_offset);

  -- Per-view placement of a scene link. A link is drawn on its angle in every option,
  -- but the exit it marks may sit elsewhere in each option's frame, so each view may
  -- override the link's own position_x/position_y. The base option at angle 0 has no
  -- row here — it keeps using the link row itself.
  CREATE TABLE IF NOT EXISTS scene_link_angles (
    link_id TEXT NOT NULL,
    variant_id TEXT,
    angle_offset INTEGER NOT NULL,
    position_x REAL NOT NULL,
    position_y REAL NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS scene_link_angles_slot
    ON scene_link_angles (link_id, IFNULL(variant_id, ''), angle_offset);

  -- Free-form notes kept alongside a world, worked through like a todo list.
  -- position is the manual ordering the author gives them; done marks a note as handled.
  CREATE TABLE IF NOT EXISTS world_notes (
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    done INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS world_notes_by_world ON world_notes (world_id, position);

  -- When each option index takes over, as minutes since midnight on the world clock.
  -- Options are the same scene at a later moment, and every scene turns over together:
  -- option 1 of the kitchen and option 1 of the hallway share one activation minute,
  -- so the time belongs to the world, not to a single scene. Index 0 is the scene's own
  -- image and doubles as the world's opening time; without a row it defaults to 12:00.
  CREATE TABLE IF NOT EXISTS world_option_times (
    world_id TEXT NOT NULL,
    option_index INTEGER NOT NULL,
    minute_of_day INTEGER NOT NULL,
    PRIMARY KEY (world_id, option_index)
  );
`)

// Options gained a place in that chain. They used to be an unordered set per scene, so
// creation order is the order they were meant to unfold in.
try {
  db.exec(`ALTER TABLE scene_variants ADD COLUMN option_index INTEGER NOT NULL DEFAULT 0`)

  const sceneIds = db
    .prepare('SELECT DISTINCT scene_id FROM scene_variants')
    .all() as { scene_id: string }[]
  const byCreation = db.prepare('SELECT id FROM scene_variants WHERE scene_id = ? ORDER BY created_at ASC')
  const setIndex = db.prepare('UPDATE scene_variants SET option_index = ? WHERE id = ?')

  for (const { scene_id } of sceneIds) {
    const variants = byCreation.all(scene_id) as { id: string }[]
    variants.forEach((variant, index) => setIndex.run(index + 1, variant.id))
  }
} catch {
  // column already exists
}

// Stories gained an angle: a story now hangs off one angle of one option, not the
// whole option. Everything written before angles existed belongs to angle 0.
try {
  db.exec(`ALTER TABLE story_frames ADD COLUMN angle_offset INTEGER NOT NULL DEFAULT 0`)
} catch {
  // column already exists
}

// Links gained an angle: each view of a scene — the option image and every angle —
// holds at most one exit, so a link now names the angle it is drawn on. It is the
// same angle across every option. Links written before this sat on the option image.
try {
  db.exec(`ALTER TABLE scene_links ADD COLUMN angle_offset INTEGER NOT NULL DEFAULT 0`)
} catch {
  // column already exists
}

// Every image of a scene gained a heading: the direction it looks in, in degrees
// clockwise from 12 o'clock, drawn as a hand on the scene's angle ring. A scene's own
// image is its front and starts at 12. Angles written before this have no heading —
// which way they face was never recorded, so it stays unset until the author sets it.
try {
  db.exec(`ALTER TABLE scenes ADD COLUMN heading INTEGER NOT NULL DEFAULT 0`)
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE scene_angles ADD COLUMN heading INTEGER`)
} catch {
  // column already exists
}

// A view can be magnetic: someone arriving from another location is pulled to the
// magnetic view nearest the way they were facing, ahead of a plain view that faces
// exactly that way. Both the scene's own image and its angles can be.
for (const table of ['scenes', 'scene_angles']) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN magnetic INTEGER NOT NULL DEFAULT 0`)
  } catch {
    // column already exists
  }
}

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

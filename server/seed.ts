import { db } from './db.ts'

const worldCount = db.prepare('SELECT COUNT(*) as count FROM worlds').get() as { count: number }

if (worldCount.count === 0) {
  const now = Date.now()
  const insertWorld = db.prepare(`
    INSERT INTO worlds (id, slot, name, scene_id, scene_label, scene_image_url, progress, play_time_minutes, last_played_at, created_at)
    VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
  `)

  const seedWorlds = [
    { slot: 1, name: 'New Life #1', sceneId: 'salon', sceneLabel: 'Salon', progress: 0.68, playTime: 2140, daysAgo: 0 },
    { slot: 2, name: 'New Life #2', sceneId: 'yatak-odasi', sceneLabel: 'Yatak Odası', progress: 0.42, playTime: 860, daysAgo: 2 },
    { slot: 3, name: 'New Life #3', sceneId: 'mutfak', sceneLabel: 'Mutfak', progress: 0.31, playTime: 540, daysAgo: 5 },
    { slot: 4, name: 'New Life #4', sceneId: 'ofis', sceneLabel: 'Ofis', progress: 0.55, playTime: 1290, daysAgo: 9 },
    { slot: 5, name: 'New Life #5', sceneId: 'sehir', sceneLabel: 'Şehir', progress: 0.19, playTime: 210, daysAgo: 14 },
    { slot: 6, name: 'New Life #6', sceneId: 'park', sceneLabel: 'Park', progress: 0.04, playTime: 35, daysAgo: 21 },
  ]

  for (const world of seedWorlds) {
    const lastPlayedAt = new Date(now - world.daysAgo * 86_400_000).toISOString()
    const createdAt = new Date(now - (world.daysAgo + 30) * 86_400_000).toISOString()
    insertWorld.run(
      `world-${world.slot}`,
      world.slot,
      world.name,
      world.sceneId,
      world.sceneLabel,
      world.progress,
      world.playTime,
      lastPlayedAt,
      createdAt,
    )
  }
}

const profileCount = db.prepare('SELECT COUNT(*) as count FROM profile').get() as { count: number }

if (profileCount.count === 0) {
  db.prepare(`
    INSERT INTO profile (id, display_name, avatar_seed, xp, level, is_premium, unread_notifications)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('player-1', 'Kaşif', 'new-life-player-1', 4280, 12, 1, 3)
}

export const tr = {
  brand: {
    title: 'NEW LIFE',
    tagline: 'Hikayeni Sen Yaz.',
  },
  menu: {
    continue: 'Devam Et',
    newWorld: 'Yeni Dünya',
    saves: 'Kayıtlar',
    settings: 'Ayarlar',
    music: 'Müzik',
    help: 'Yardım',
    exit: 'Çıkış',
  },
  world: {
    prefix: 'New Life',
    lastPlayed: 'Son oynama',
    progress: 'İlerleme',
    createdAt: 'Kayıt tarihi',
  },
  profile: {
    level: 'Seviye',
    xp: 'XP',
    premium: 'Premium',
    notifications: 'Bildirimler',
  },
  status: {
    version: 'v1.0',
    fps: 'FPS',
    sqlite: 'SQLite',
    ai: 'AI',
    connected: 'Bağlı',
    disconnected: 'Bağlantı Yok',
  },
  loading: {
    title: 'Dünyan Yükleniyor',
    subtitle: 'Hikayen kaldığın yerden devam ediyor…',
  },
  scenes: {
    salon: 'Salon',
    'yatak-odasi': 'Yatak Odası',
    mutfak: 'Mutfak',
    ofis: 'Ofis',
    sehir: 'Şehir',
    park: 'Park',
  },
} as const

export type Strings = typeof tr

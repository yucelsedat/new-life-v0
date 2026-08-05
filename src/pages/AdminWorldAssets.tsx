import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FiArrowLeft } from 'react-icons/fi'
import { useT } from '../i18n'
import ImageLibrarySection from '../components/admin/ImageLibrarySection'

export default function AdminWorldAssets() {
  const t = useT()
  const { worldId } = useParams<{ worldId: string }>()
  const [worldName, setWorldName] = useState<string | null>(null)

  useEffect(() => {
    if (!worldId) return
    fetch(`/api/worlds/${worldId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setWorldName(data?.name ?? null))
      .catch(() => setWorldName(null))
  }, [worldId])

  if (!worldId) return null

  return (
    <div className="scrollbar-none h-screen w-full overflow-y-auto bg-void text-white/90">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-8 md:px-12">
        <div>
          <h1 className="font-display text-h1 font-[300] text-white/95">{t.admin.assets.title}</h1>
          {worldName && <p className="mt-1 font-sans text-caption text-mist">{worldName}</p>}
        </div>
        <Link
          to="/admin"
          className="flex shrink-0 items-center gap-2 rounded-full border border-white/15 px-4 py-2 font-sans text-caption text-white/70 transition hover:border-gold-bright hover:text-gold-bright"
        >
          <FiArrowLeft className="h-3.5 w-3.5" />
          {t.admin.assets.backToWorlds}
        </Link>
      </header>

      <main className="flex flex-col gap-12 px-6 py-10 md:px-12">
        <ImageLibrarySection
          title={t.admin.assets.scenesTitle}
          subtitle={t.admin.assets.scenesSubtitle}
          emptyLabel={t.admin.assets.scenesEmpty}
          scope={{ worldId, kind: 'scene' }}
        />

        <ImageLibrarySection
          title={t.admin.assets.charactersTitle}
          subtitle={t.admin.assets.charactersSubtitle}
          emptyLabel={t.admin.assets.charactersEmpty}
          scope={{ worldId, kind: 'character' }}
        />
      </main>
    </div>
  )
}

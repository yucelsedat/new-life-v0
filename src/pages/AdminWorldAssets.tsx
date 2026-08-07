import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FiArrowLeft, FiEdit3 } from 'react-icons/fi'
import { useT } from '../i18n'
import ImageLibrarySection from '../components/admin/ImageLibrarySection'

type AssetTab = 'scene' | 'character'

const TABS = [
  { id: 'scene', labelKey: 'scenesTab' },
  { id: 'character', labelKey: 'charactersTab' },
] as const satisfies ReadonlyArray<{ id: AssetTab; labelKey: 'scenesTab' | 'charactersTab' }>

export default function AdminWorldAssets() {
  const t = useT()
  const { worldId } = useParams<{ worldId: string }>()
  const [worldName, setWorldName] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<AssetTab>('scene')

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
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to={`/admin/worlds/${worldId}`}
            className="flex shrink-0 items-center gap-2 rounded-full border border-white/15 px-4 py-2 font-sans text-caption text-white/70 transition hover:border-gold-bright hover:text-gold-bright"
          >
            <FiEdit3 className="h-3.5 w-3.5" />
            {t.admin.worlds.editButton}
          </Link>
          <Link
            to="/admin"
            className="flex shrink-0 items-center gap-2 rounded-full border border-white/15 px-4 py-2 font-sans text-caption text-white/70 transition hover:border-gold-bright hover:text-gold-bright"
          >
            <FiArrowLeft className="h-3.5 w-3.5" />
            {t.admin.assets.backToWorlds}
          </Link>
        </div>
      </header>

      <main className="flex flex-col gap-8 px-6 py-10 md:px-12">
        <div role="tablist" className="flex items-center gap-1 self-start rounded-full border border-white/10 bg-black/30 p-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-5 py-2 font-sans text-caption font-[700] transition ${
                  isActive
                    ? 'bg-gradient-to-r from-gold to-gold-bright text-abyss'
                    : 'text-white/60 hover:text-white/90'
                }`}
              >
                {t.admin.assets[tab.labelKey]}
              </button>
            )
          })}
        </div>

        {activeTab === 'scene' ? (
          <ImageLibrarySection
            title={t.admin.assets.scenesTitle}
            subtitle={t.admin.assets.scenesSubtitle}
            emptyLabel={t.admin.assets.scenesEmpty}
            scope={{ worldId, kind: 'scene' }}
          />
        ) : (
          <ImageLibrarySection
            title={t.admin.assets.charactersTitle}
            subtitle={t.admin.assets.charactersSubtitle}
            emptyLabel={t.admin.assets.charactersEmpty}
            scope={{ worldId, kind: 'character' }}
          />
        )}
      </main>
    </div>
  )
}

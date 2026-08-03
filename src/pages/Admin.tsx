import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft } from 'react-icons/fi'
import { useT } from '../i18n'
import AdminWorldsPanel from '../components/admin/AdminWorldsPanel'
import AdminGalleryPanel from '../components/admin/AdminGalleryPanel'

type AdminTab = 'worlds' | 'gallery'

export default function Admin() {
  const t = useT()
  const [tab, setTab] = useState<AdminTab>('worlds')

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'worlds', label: t.admin.tabs.worlds },
    { id: 'gallery', label: t.admin.tabs.gallery },
  ]

  return (
    <div className="min-h-screen w-full bg-void text-white/90">
      <header className="flex flex-col gap-6 border-b border-white/10 px-6 py-8 md:px-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-h1 font-[300] text-white/95">{t.admin.title}</h1>
            <p className="mt-1 font-sans text-caption text-mist">{t.admin.subtitle}</p>
          </div>
          <Link
            to="/"
            className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 font-sans text-caption text-white/70 transition hover:border-gold-bright hover:text-gold-bright"
          >
            <FiArrowLeft className="h-3.5 w-3.5" />
            {t.admin.backToHome}
          </Link>
        </div>

        <nav className="flex gap-1 rounded-full border border-white/10 bg-black/30 p-1 self-start">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-5 py-2 font-sans text-caption font-[700] transition-colors duration-300 ${
                tab === id ? 'bg-gradient-to-r from-gold to-gold-bright text-abyss' : 'text-white/60 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="px-6 py-10 md:px-12">
        {tab === 'worlds' ? <AdminWorldsPanel /> : <AdminGalleryPanel />}
      </main>
    </div>
  )
}

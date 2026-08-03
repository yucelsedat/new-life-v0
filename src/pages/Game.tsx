import { Link, useParams } from 'react-router-dom'
import { useWorldEditor } from '../hooks/useWorldEditor'
import type { SceneLink } from '../types/world'

function ScenePinButton({ link, onNavigate }: { link: SceneLink; onNavigate: (sceneId: string) => void }) {
  return (
    <button
      type="button"
      style={{ left: `${link.positionX}%`, top: `${link.positionY}%` }}
      onClick={() => onNavigate(link.toSceneId)}
      className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
    >
      <span className="h-4 w-4 rounded-full bg-gold-bright shadow-[0_0_16px_6px_rgba(232,199,102,0.55)] ring-2 ring-white/70 transition group-hover:scale-110" />
      <span className="rounded-full border border-white/15 bg-black/60 px-3 py-1 font-sans text-caption font-[700] text-white/90 backdrop-blur-md transition group-hover:border-gold-bright">
        {link.label}
      </span>
    </button>
  )
}

export default function Game() {
  const { worldId } = useParams<{ worldId: string }>()
  const { currentScene, isLoading, scenes, goToScene } = useWorldEditor(worldId ?? '')

  return (
    <div className="relative h-screen max-h-screen w-screen overflow-hidden bg-void">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-6 py-5">
        <Link
          to="/"
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-2 font-sans text-caption text-white/70 backdrop-blur-md transition hover:border-gold-bright hover:text-gold-bright"
        >
          Ana Menüye Dön
        </Link>
      </div>

      {!isLoading && scenes.length === 0 && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="font-display text-h1 font-[200] text-white/90">Bu Dünya Henüz Boş</span>
          <span className="font-sans text-caption text-mist">
            Bu dünya için hiç sahne oluşturulmadı. Dünya Mutfağı'ndan ilk sahneni oluştur.
          </span>
        </div>
      )}

      {currentScene && (
        <div className="relative h-full max-h-screen w-full">
          <img
            src={currentScene.imageUrl}
            alt={currentScene.name}
            className="absolute inset-0 h-full max-h-screen w-full object-cover"
          />

          {(currentScene.links ?? []).map((link) => (
            <ScenePinButton key={link.id} link={link} onNavigate={goToScene} />
          ))}
        </div>
      )}
    </div>
  )
}

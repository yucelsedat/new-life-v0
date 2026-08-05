import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FiArrowRight } from 'react-icons/fi'
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

  /** How many times each scene has been entered this session — drives variant cycling. */
  const [visitCounts, setVisitCounts] = useState<Record<string, number>>({})

  const currentSceneId = currentScene?.id
  useEffect(() => {
    if (!currentSceneId) return
    setVisitCounts((prev) => ({ ...prev, [currentSceneId]: (prev[currentSceneId] ?? 0) + 1 }))
  }, [currentSceneId])

  /** -1 = showing the option image; 0..n-1 = a story frame of the active option. */
  const [storyIndex, setStoryIndex] = useState(-1)
  useEffect(() => {
    setStoryIndex(-1)
  }, [currentSceneId])

  /**
   * First visit shows the scene's base image; each subsequent visit advances to the
   * next configured option, wrapping back around to the base image.
   */
  const activeOption = useMemo(() => {
    if (!currentScene) return null
    const options = [
      { key: 'base', imageUrl: currentScene.imageUrl },
      ...(currentScene.variants ?? []).map((variant) => ({ key: variant.id, imageUrl: variant.imageUrl })),
    ]
    const visits = visitCounts[currentScene.id] ?? 1
    return options[(visits - 1) % options.length]
  }, [currentScene, visitCounts])

  const storyFrames = activeOption ? (currentScene?.stories?.[activeOption.key] ?? []) : []
  const canAdvance = storyFrames.length > 0 && storyIndex < storyFrames.length - 1
  // With a story configured, the exits only appear once the player reaches its last frame.
  const showLinks = storyFrames.length === 0 ? storyIndex < 0 : storyIndex === storyFrames.length - 1
  const displayedImageUrl =
    storyIndex >= 0 ? (storyFrames[storyIndex]?.imageUrl ?? activeOption?.imageUrl ?? null) : (activeOption?.imageUrl ?? null)

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

      {currentScene && displayedImageUrl && (
        <div className="relative h-full max-h-screen w-full">
          <img
            key={displayedImageUrl}
            src={displayedImageUrl}
            alt={currentScene.name}
            className="absolute inset-0 h-full max-h-screen w-full object-cover"
          />

          {showLinks &&
            (currentScene.links ?? []).map((link) => (
              <ScenePinButton key={link.id} link={link} onNavigate={goToScene} />
            ))}

          {canAdvance && (
            <button
              type="button"
              onClick={() => setStoryIndex((prev) => prev + 1)}
              className="absolute right-8 top-1/2 z-20 flex -translate-y-1/2 items-center gap-2 rounded-full bg-gradient-to-r from-gold to-gold-bright px-5 py-4 font-sans text-body font-[700] text-abyss shadow-lg transition hover:brightness-105"
            >
              İlerle
              <FiArrowRight className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

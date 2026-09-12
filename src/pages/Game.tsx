import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FiArrowLeft, FiArrowRight, FiClock } from 'react-icons/fi'
import { useWorldEditor } from '../hooks/useWorldEditor'
import { useWorldClock } from '../hooks/useWorldClock'
import { useAngleKeys } from '../hooks/useAngleKeys'
import { useWorldOptionTimes } from '../hooks/useWorldOptionTimes'
import { activeOptionIndex, formatClock, minuteOfDayFor } from '../utils/worldClock'
import { viewKey } from '../types/world'
import type { SceneLink } from '../types/world'

function ScenePinButton({
  link,
  position,
  onNavigate,
}: {
  link: SceneLink
  position: { x: number; y: number }
  onNavigate: (sceneId: string) => void
}) {
  return (
    <button
      type="button"
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
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
  const { optionTimes } = useWorldOptionTimes(worldId ?? '')

  // The world runs on its own clock; how far it has got decides which version of every
  // scene is standing, so the whole world moves on together.
  const elapsedMinutes = useWorldClock()
  const clock = formatClock(minuteOfDayFor(optionTimes, elapsedMinutes))
  const worldOptionIndex = activeOptionIndex(optionTimes, elapsedMinutes)

  const currentSceneId = currentScene?.id

  /** -1 = showing the view image; 0..n-1 = a story frame of the active view. */
  const [storyIndex, setStoryIndex] = useState(-1)
  /** Which way the player has turned within the active option. 0 = the option image. */
  const [angleOffset, setAngleOffset] = useState(0)

  /**
   * The scene as of now: its latest option at or before the world's current index. A
   * scene with fewer options than the world has reached simply stays at its last one.
   */
  const activeOption = useMemo(() => {
    if (!currentScene) return null
    const options = [
      { key: 'base', optionIndex: 0, imageUrl: currentScene.imageUrl },
      ...(currentScene.variants ?? []).map((variant) => ({
        key: variant.id,
        optionIndex: variant.optionIndex,
        imageUrl: variant.imageUrl,
      })),
    ]
    const reached = options.filter((option) => option.optionIndex <= worldOptionIndex)
    return reached[reached.length - 1] ?? options[0]
  }, [currentScene, worldOptionIndex])

  // Walking into a scene, and the world moving on under your feet, both land you on a
  // fresh view — the story starts over and the camera faces forward again.
  const activeOptionKey = activeOption?.key
  useEffect(() => {
    setStoryIndex(-1)
    setAngleOffset(0)
  }, [currentSceneId, activeOptionKey])

  // Turning left or right stays inside the scene — the same exits remain reachable,
  // just placed where they belong in that view.
  const optionAngles = activeOption ? (currentScene?.angles?.[activeOption.key] ?? []) : []
  const activeAngle = optionAngles.find((angle) => angle.offset === angleOffset)
  const viewImageUrl = angleOffset === 0 ? (activeOption?.imageUrl ?? null) : (activeAngle?.imageUrl ?? null)
  const hasAngleAt = (offset: number) => offset === 0 || optionAngles.some((angle) => angle.offset === offset)
  const canLookLeft = hasAngleAt(angleOffset - 1)
  const canLookRight = hasAngleAt(angleOffset + 1)

  const currentViewKey = activeOption ? viewKey(activeOption.key, angleOffset) : null
  const storyFrames = currentViewKey ? (currentScene?.stories?.[currentViewKey] ?? []) : []
  const canAdvance = storyFrames.length > 0 && storyIndex < storyFrames.length - 1
  // With a story configured, the exits only appear once the player reaches its last frame.
  const showLinks = storyFrames.length === 0 ? storyIndex < 0 : storyIndex === storyFrames.length - 1
  const displayedImageUrl = storyIndex >= 0 ? (storyFrames[storyIndex]?.imageUrl ?? viewImageUrl) : viewImageUrl

  function lookTowards(offset: number) {
    setAngleOffset(offset)
    setStoryIndex(-1)
  }

  // A and D do what the on-screen arrows do, and are just as limited by where the
  // scene actually has an angle to turn to.
  useAngleKeys({
    enabled: storyIndex < 0,
    onLookLeft: () => canLookLeft && lookTowards(angleOffset - 1),
    onLookRight: () => canLookRight && lookTowards(angleOffset + 1),
  })

  return (
    <div className="relative h-screen max-h-screen w-screen overflow-hidden bg-void">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-6 py-5">
        <Link
          to="/"
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-2 font-sans text-caption text-white/70 backdrop-blur-md transition hover:border-gold-bright hover:text-gold-bright"
        >
          Ana Menüye Dön
        </Link>

        <span className="flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-2 backdrop-blur-md">
          <FiClock className="h-4 w-4 text-gold-bright" />
          <span className="font-mono text-h3 font-[200] tabular-nums tracking-widest text-white/95">{clock}</span>
        </span>
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
            (currentScene.links ?? []).map((link) => {
              const override = currentViewKey ? link.anglePositions?.[currentViewKey] : undefined
              return (
                <ScenePinButton
                  key={link.id}
                  link={link}
                  position={{
                    x: override?.positionX ?? link.positionX,
                    y: override?.positionY ?? link.positionY,
                  }}
                  onNavigate={goToScene}
                />
              )
            })}

          {storyIndex < 0 && canLookLeft && (
            <button
              type="button"
              onClick={() => lookTowards(angleOffset - 1)}
              title="Sola bak (A)"
              className="absolute left-6 top-1/2 z-20 flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/80 backdrop-blur-md transition hover:border-gold-bright hover:text-gold-bright"
            >
              <FiArrowLeft className="h-7 w-7" />
            </button>
          )}

          {storyIndex < 0 && canLookRight && (
            <button
              type="button"
              onClick={() => lookTowards(angleOffset + 1)}
              title="Sağa bak (D)"
              className="absolute right-6 top-1/2 z-20 flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/80 backdrop-blur-md transition hover:border-gold-bright hover:text-gold-bright"
            >
              <FiArrowRight className="h-7 w-7" />
            </button>
          )}

          {canAdvance && (
            <button
              type="button"
              onClick={() => setStoryIndex((prev) => prev + 1)}
              className="absolute right-8 top-[calc(50%+6rem)] z-20 flex -translate-y-1/2 items-center gap-2 rounded-full bg-gradient-to-r from-gold to-gold-bright px-5 py-4 font-sans text-body font-[700] text-abyss shadow-lg transition hover:brightness-105"
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

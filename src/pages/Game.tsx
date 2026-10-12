import { useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FiArrowLeft, FiArrowRight, FiClock } from 'react-icons/fi'
import { useWorldEditor } from '../hooks/useWorldEditor'
import { useWorldClock } from '../hooks/useWorldClock'
import { useAngleKeys } from '../hooks/useAngleKeys'
import { useLinkKey } from '../hooks/useLinkKey'
import { useStoryKey } from '../hooks/useStoryKey'
import { useHoldZoom } from '../hooks/useHoldZoom'
import { useWorldOptionTimes } from '../hooks/useWorldOptionTimes'
import { MINUTES_PER_DAY, activeOptionIndex, formatClock, minuteOfDayFor, startMinute } from '../utils/worldClock'
import { arrivalOffset, ringHands, turnAngle } from '../utils/heading'
import { storyTriggerMinute, viewKey } from '../types/world'
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
      title={`${link.label} (W)`}
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

  /** -1 = showing the view image; 0..n-1 = a story frame of the active view. */
  const [storyIndex, setStoryIndex] = useState(-1)
  /**
   * The timed stories that have already played, as `<scene>|<view>` — each plays once,
   * however often the player comes back to its view afterwards.
   */
  const [playedStories, setPlayedStories] = useState<ReadonlySet<string>>(() => new Set())

  // The world runs on its own clock; how far it has got decides which version of every
  // scene is standing, so the whole world moves on together. It holds still while a
  // story is on screen, so the world cannot turn over under it mid-scene.
  const elapsedMinutes = useWorldClock(storyIndex < 0)
  const clock = formatClock(minuteOfDayFor(optionTimes, elapsedMinutes))
  const worldOptionIndex = activeOptionIndex(optionTimes, elapsedMinutes)

  const currentSceneId = currentScene?.id
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

  // Turning left or right stays inside the scene; each view shows the exit it holds.
  const optionAngles = activeOption ? (currentScene?.angles?.[activeOption.key] ?? []) : []
  const optionHands = ringHands(currentScene?.heading ?? 0, optionAngles, currentScene?.magnetic)
  const activeHand = optionHands.find((hand) => hand.offset === angleOffset)

  /**
   * The way the player was looking when they walked through a link, kept until the next
   * location has loaded. Null is a view with no heading on record; undefined means
   * nobody is on the way anywhere.
   */
  const [travelHeading, setTravelHeading] = useState<number | null | undefined>(undefined)

  // Walking into a location lands you on the view that answers the way you came in
  // looking; the world moving on under your feet faces the camera forward again. Either
  // way the story starts over. Adjusted while rendering rather than in an effect, so the
  // new location never shows for a frame at the view left over from the last one.
  const activeOptionKey = activeOption?.key
  const [shown, setShown] = useState({ sceneId: currentSceneId, optionKey: activeOptionKey })
  const viewChanging = shown.sceneId !== currentSceneId || shown.optionKey !== activeOptionKey
  if (viewChanging) {
    const arrived = shown.sceneId !== currentSceneId
    setShown({ sceneId: currentSceneId, optionKey: activeOptionKey })
    setStoryIndex(-1)
    setAngleOffset(arrived && travelHeading !== undefined ? arrivalOffset(travelHeading, optionHands) : 0)
    if (arrived) setTravelHeading(undefined)
  }

  const activeAngle = optionAngles.find((angle) => angle.offset === angleOffset)
  const viewImageUrl = angleOffset === 0 ? (activeOption?.imageUrl ?? null) : (activeAngle?.imageUrl ?? null)
  const leftOffset = turnAngle(angleOffset, currentScene?.heading ?? 0, optionAngles, 'left')
  const rightOffset = turnAngle(angleOffset, currentScene?.heading ?? 0, optionAngles, 'right')

  const currentViewKey = activeOption ? viewKey(activeOption.key, angleOffset) : null
  const storyFrames = currentViewKey ? (currentScene?.stories?.[currentViewKey] ?? []) : []
  const storyTrigger = storyTriggerMinute(storyFrames)
  const isTimedStory = storyTrigger !== null
  const isLastFrame = storyIndex === storyFrames.length - 1

  // A timed story plays by itself once the clock has reached its minute — the moment the
  // player is on its view then, or the moment they turn to it later. Its minute is read
  // against the opening minute, as option times are, so one set before it falls on the
  // next day. Started while rendering, so the view never shows for a frame without it.
  const storyKey = currentSceneId && currentViewKey ? `${currentSceneId}|${currentViewKey}` : null
  const storyDue =
    isTimedStory &&
    storyKey !== null &&
    !playedStories.has(storyKey) &&
    elapsedMinutes >= (storyTrigger - startMinute(optionTimes) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  if (!viewChanging && storyDue && storyIndex < 0) {
    setStoryIndex(0)
    setPlayedStories((prev) => new Set(prev).add(storyKey))
  }

  // A story the player starts runs up to its last frame and stays there with the exits;
  // a timed one is not theirs to start, and its last step hands the view back.
  const canAdvance =
    storyIndex >= 0 ? !isLastFrame || isTimedStory : !isTimedStory && storyFrames.length > 0
  // With a story the player starts, the exits only appear once they reach its last
  // frame. A timed story keeps them hidden while it plays and leaves the view as it was.
  const showLinks = isTimedStory || storyFrames.length === 0 ? storyIndex < 0 : isLastFrame

  function advanceStory() {
    setStoryIndex((prev) => (isTimedStory && prev >= storyFrames.length - 1 ? -1 : prev + 1))
  }
  // Each link hangs off one angle; turning brings a different exit into view.
  const viewLinks = (currentScene?.links ?? []).filter((link) => link.angleOffset === angleOffset)
  const followLink = viewLinks[0]
  const displayedImageUrl = storyIndex >= 0 ? (storyFrames[storyIndex]?.imageUrl ?? viewImageUrl) : viewImageUrl

  function lookTowards(offset: number) {
    setAngleOffset(offset)
    setStoryIndex(-1)
  }

  /** Walk through a link, taking along the way this view looks so the next location can answer it. */
  function followLinkTo(sceneId: string) {
    setTravelHeading(activeHand?.isSet ? activeHand.heading : null)
    goToScene(sceneId)
  }

  // A and D do what the on-screen arrows do, and are just as limited by whether the
  // option has any angle to turn to.
  useAngleKeys({
    enabled: storyIndex < 0,
    onLookLeft: () => leftOffset !== null && lookTowards(leftOffset),
    onLookRight: () => rightOffset !== null && lookTowards(rightOffset),
  })

  // Holding C leans in on the picture towards the cursor.
  const sceneLayerRef = useRef<HTMLDivElement>(null)
  const zoomStyle = useHoldZoom(sceneLayerRef, { enabled: true })

  // F steps the story on, just as the İlerle button does.
  useStoryKey({ enabled: canAdvance, onAdvance: advanceStory })

  // W walks through the exit on screen, just as clicking its pin does — so only once the
  // pin is showing.
  useLinkKey({
    enabled: showLinks && followLink !== undefined,
    onFollowLink: () => followLink && followLinkTo(followLink.toSceneId),
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
        <div className="relative h-full max-h-screen w-full overflow-hidden">
          {/* The picture and its pins zoom together under C, so a pin stays on its spot;
              the controls around them stay put. */}
          <div ref={sceneLayerRef} style={zoomStyle} className="absolute inset-0">
            <img
              key={displayedImageUrl}
              src={displayedImageUrl}
              alt={currentScene.name}
              className="absolute inset-0 h-full max-h-screen w-full object-cover"
            />

            {showLinks &&
              viewLinks.map((link) => {
                const override = currentViewKey ? link.anglePositions?.[currentViewKey] : undefined
                return (
                  <ScenePinButton
                    key={link.id}
                    link={link}
                    position={{
                      x: override?.positionX ?? link.positionX,
                      y: override?.positionY ?? link.positionY,
                    }}
                    onNavigate={followLinkTo}
                  />
                )
              })}
          </div>

          {storyIndex < 0 && leftOffset !== null && (
            <button
              type="button"
              onClick={() => lookTowards(leftOffset)}
              title="Sola bak (A)"
              className="absolute left-6 top-1/2 z-20 flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/80 backdrop-blur-md transition hover:border-gold-bright hover:text-gold-bright"
            >
              <FiArrowLeft className="h-7 w-7" />
            </button>
          )}

          {storyIndex < 0 && rightOffset !== null && (
            <button
              type="button"
              onClick={() => lookTowards(rightOffset)}
              title="Sağa bak (D)"
              className="absolute right-6 top-1/2 z-20 flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/80 backdrop-blur-md transition hover:border-gold-bright hover:text-gold-bright"
            >
              <FiArrowRight className="h-7 w-7" />
            </button>
          )}

          {canAdvance && (
            <button
              type="button"
              onClick={advanceStory}
              className="absolute right-8 top-[calc(50%+6rem)] z-20 flex -translate-y-1/2 items-center gap-2 rounded-full bg-gradient-to-r from-gold to-gold-bright px-5 py-4 font-sans text-body font-[700] text-abyss shadow-lg transition hover:brightness-105"
            >
              {storyIndex >= 0 && isLastFrame ? 'Bitir' : 'İlerle'}
              <kbd className="rounded-md bg-abyss/15 px-1.5 font-mono text-micro font-[800]">F</kbd>
              <FiArrowRight className="h-5 w-5" />
            </button>
          )}

          {storyIndex >= 0 && (
            <span className="absolute bottom-8 right-8 z-20 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 font-mono text-micro text-white/80 backdrop-blur-md">
              {storyIndex + 1} / {storyFrames.length}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

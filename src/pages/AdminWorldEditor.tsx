import { useEffect, useRef, useState } from 'react'
import { LuMagnet } from 'react-icons/lu'
import { Link, useParams } from 'react-router-dom'
import {
  FiArrowLeft,
  FiArrowRight,
  FiBookOpen,
  FiCompass,
  FiCopy,
  FiGrid,
  FiImage,
  FiPlusCircle,
  FiRefreshCw,
  FiTrash2,
} from 'react-icons/fi'
import { useT } from '../i18n'
import { useWorldEditor } from '../hooks/useWorldEditor'
import { useUsedImages } from '../hooks/useUsedImages'
import { useWorldOptionTimes } from '../hooks/useWorldOptionTimes'
import { useAngleKeys } from '../hooks/useAngleKeys'
import { useLinkKey } from '../hooks/useLinkKey'
import GalleryPickerModal from '../components/admin/GalleryPickerModal'
import StoryPickerModal from '../components/admin/StoryPickerModal'
import AnglePickerModal from '../components/admin/AnglePickerModal'
import OptionTimeField from '../components/admin/OptionTimeField'
import LinkMoveMenu from '../components/admin/LinkMoveMenu'
import DeleteConnectionModal from '../components/admin/DeleteConnectionModal'
import { clamp } from '../utils/helpers'
import { formatClock } from '../utils/worldClock'
import { arrivalOffset, headingHour, ringHands, turnAngle } from '../utils/heading'
import { viewKey } from '../types/world'
import type { SceneLink } from '../types/world'

type ModalMode = 'first-scene' | 'create-link' | 'create-variant' | 'change-image' | null

interface ScenePinProps {
  link: SceneLink
  title: string
  position: { x: number; y: number }
  containerRef: React.RefObject<HTMLDivElement | null>
  onDragEnd: (linkId: string, x: number, y: number) => void
  onNavigate: (sceneId: string) => void
}

function ScenePin({ link, title, position, containerRef, onDragEnd, onNavigate }: ScenePinProps) {
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const pos = dragPos ?? position

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    event.stopPropagation()
    draggingRef.current = true
    movedRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current || !containerRef.current) return
    movedRef.current = true
    const rect = containerRef.current.getBoundingClientRect()
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100)
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100)
    setDragPos({ x, y })
  }

  function handlePointerUp() {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (movedRef.current && dragPos) {
      onDragEnd(link.id, dragPos.x, dragPos.y)
    } else {
      onNavigate(link.toSceneId)
    }
    setDragPos(null)
  }

  return (
    <button
      type="button"
      title={title}
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      className="absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center gap-1.5 active:cursor-grabbing"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <span className="h-4 w-4 rounded-full bg-gold-bright shadow-[0_0_16px_6px_rgba(232,199,102,0.55)] ring-2 ring-white/70" />
      <span className="rounded-full border border-white/15 bg-black/60 px-3 py-1 font-sans text-caption font-[700] text-white/90 backdrop-blur-md">
        {link.label}
      </span>
    </button>
  )
}

export default function AdminWorldEditor() {
  const t = useT()
  const { worldId } = useParams<{ worldId: string }>()
  const {
    scenes,
    currentScene,
    isLoading,
    createFirstScene,
    createLink,
    createVariant,
    createAngle,
    deleteAngle,
    setViewMagnetic,
    saveStory,
    changeViewImage,
    goToScene,
    moveLinkToAngle,
    deleteLink,
    updateLinkPosition,
  } = useWorldEditor(worldId ?? '')
  const { usedUrls, refetchUsed } = useUsedImages(worldId ?? '')
  const { timeFor, setOptionTime } = useWorldOptionTimes(worldId ?? '')

  const [worldName, setWorldName] = useState<string | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  /** 'base' = the scene's own image, otherwise a variant id. */
  const [activeOption, setActiveOption] = useState<string>('base')
  /** Which way the camera is turned within the active option. 0 = the option image. */
  const [angleOffset, setAngleOffset] = useState(0)
  /** -1 = showing the view image itself; 0..n-1 = story frame index. */
  const [storyIndex, setStoryIndex] = useState(-1)
  const [storyModalOpen, setStoryModalOpen] = useState(false)
  const [angleModalOpen, setAngleModalOpen] = useState(false)
  /** The link the delete dialog is open for. */
  const [linkToDelete, setLinkToDelete] = useState<SceneLink | null>(null)
  const [linkDeleteError, setLinkDeleteError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const backgroundRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!worldId) return
    fetch(`/api/worlds/${worldId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setWorldName(data?.name ?? null))
      .catch(() => setWorldName(null))
  }, [worldId])

  /**
   * The way the view on screen was looking when its link was followed, kept until the
   * next location has loaded. Null is a view with no heading on record; undefined means
   * nobody is on the way anywhere.
   */
  const [travelHeading, setTravelHeading] = useState<number | null | undefined>(undefined)

  // Arriving at a location picks the view to open on — as the game does — on its base
  // option. Adjusted while rendering rather than in an effect, so the location never
  // shows for a frame at the view left over from the last one.
  const currentSceneId = currentScene?.id
  const [shownSceneId, setShownSceneId] = useState(currentSceneId)
  if (shownSceneId !== currentSceneId) {
    setShownSceneId(currentSceneId)
    setTravelHeading(undefined)
    setActiveOption('base')
    setAngleOffset(
      currentScene && travelHeading !== undefined
        ? arrivalOffset(
            travelHeading,
            ringHands(currentScene.heading, currentScene.angles?.base ?? [], currentScene.magnetic),
          )
        : 0,
    )
    setStoryIndex(-1)
  }

  async function handleStoryConfirm(imageUrls: string[]) {
    setIsSubmitting(true)
    try {
      await saveStory(activeOption, angleOffset, imageUrls)
      setStoryIndex(-1)
      await refetchUsed()
    } finally {
      setIsSubmitting(false)
      setStoryModalOpen(false)
    }
  }

  async function handleAngleConfirm(imageUrl: string, heading: number, magnetic: boolean) {
    setIsSubmitting(true)
    try {
      const angle = await createAngle(activeOption, imageUrl, heading, magnetic)
      // Land on the angle that was just created, so it can be furnished right away.
      if (angle) setAngleOffset(angle.offset)
      setStoryIndex(-1)
      await refetchUsed()
    } finally {
      setIsSubmitting(false)
      setAngleModalOpen(false)
    }
  }

  async function handleAngleDelete() {
    const angle = optionAngles.find((item) => item.offset === angleOffset)
    if (!angle) return
    setIsSubmitting(true)
    try {
      await deleteAngle(activeOption, angle.id)
      setAngleOffset(0)
      setStoryIndex(-1)
      await refetchUsed()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleLinkMove(linkId: string, offset: number) {
    setIsSubmitting(true)
    try {
      await moveLinkToAngle(linkId, offset)
      // Follow the link to its new angle, where its pin is most likely to need placing.
      lookTowards(offset)
    } finally {
      setIsSubmitting(false)
    }
  }

  function closeLinkDelete() {
    if (isSubmitting) return
    setLinkToDelete(null)
    setLinkDeleteError(null)
  }

  async function handleLinkDeleteConfirm() {
    if (!linkToDelete) return
    setIsSubmitting(true)
    setLinkDeleteError(null)
    try {
      if (await deleteLink(linkToDelete.id)) setLinkToDelete(null)
      else setLinkDeleteError(t.admin.disconnect.error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleModalConfirm(name: string, imageUrl: string, heading: number, magnetic: boolean) {
    setIsSubmitting(true)
    try {
      if (modalMode === 'first-scene') {
        await createFirstScene(name, imageUrl, heading, magnetic)
      } else if (modalMode === 'create-link') {
        await createLink(name, imageUrl, angleOffset, heading, magnetic)
      } else if (modalMode === 'create-variant') {
        await createVariant(imageUrl)
      } else if (modalMode === 'change-image') {
        await changeViewImage(activeOption, angleOffset, imageUrl)
      }
      await refetchUsed()
    } finally {
      setIsSubmitting(false)
      setModalMode(null)
    }
  }

  const hasNoScenes = !isLoading && scenes.length === 0
  const variantCount = currentScene?.variants?.length ?? 0

  // The option strip: the scene image first, then the scene at each later moment of the
  // world's day. An option's index is what the clock addresses, so it is world-wide —
  // option 2 here and option 2 of every other scene share one activation time.
  const options = currentScene
    ? [
        { key: 'base', optionIndex: 0, imageUrl: currentScene.imageUrl, label: t.admin.editor.baseOption },
        ...(currentScene.variants ?? []).map((variant) => ({
          key: variant.id,
          optionIndex: variant.optionIndex,
          imageUrl: variant.imageUrl,
          label: `${t.admin.editor.optionShort} ${variant.optionIndex}`,
        })),
      ]
    : []
  const activeOptionEntry = options.find((option) => option.key === activeOption)
  const activeOptionImage = activeOptionEntry?.imageUrl ?? currentScene?.imageUrl
  const activeOptionIndex = activeOptionEntry?.optionIndex ?? 0

  // The active option's ring, as the canvas draws it: its own image (offset 0) and its
  // angles, each a hand pointing the way it looks. Turning goes from hand to hand.
  const optionAngles = currentScene?.angles?.[activeOption] ?? []
  const activeAngle = optionAngles.find((angle) => angle.offset === angleOffset)
  const viewImage = angleOffset === 0 ? activeOptionImage : activeAngle?.imageUrl
  const sceneHeading = currentScene?.heading ?? 0
  const optionHands = ringHands(sceneHeading, optionAngles, currentScene?.magnetic)
  const activeHand = optionHands.find((hand) => hand.offset === angleOffset)
  const leftOffset = turnAngle(angleOffset, sceneHeading, optionAngles, 'left')
  const rightOffset = turnAngle(angleOffset, sceneHeading, optionAngles, 'right')
  const hourLabel = (heading: number) => t.admin.heading.hour.replace('{n}', String(headingHour(heading)))

  const currentViewKey = viewKey(activeOption, angleOffset)
  const storyFrames = currentScene?.stories?.[currentViewKey] ?? []
  // Advancing walks off the view image and through the story, stopping on the last frame.
  const displayedImage = storyIndex >= 0 ? (storyFrames[storyIndex]?.imageUrl ?? viewImage) : viewImage
  const canAdvance = storyFrames.length > 0 && storyIndex < storyFrames.length - 1
  // Links belong at the end of the narrative: with a story they surface on its last
  // frame, otherwise straight away on the view image.
  const showLinks = storyFrames.length === 0 ? storyIndex < 0 : storyIndex === storyFrames.length - 1
  // A link hangs off one angle, in every option. Each view holds at most one — only a
  // scene from before that rule can still have several on its option image.
  const viewLinks = (currentScene?.links ?? []).filter((link) => link.angleOffset === angleOffset)
  const followLink = viewLinks[0]
  // The option image and its angles in turning order, clockwise round the ring — where
  // a link can be moved to. Each is named by the hour its hand points at.
  const optionViews = [...optionHands]
    .sort((a, b) => a.heading - b.heading)
    .flatMap((hand) => {
      const imageUrl =
        hand.offset === 0
          ? activeOptionImage
          : optionAngles.find((angle) => angle.offset === hand.offset)?.imageUrl
      if (!imageUrl) return []
      const label = hand.isSet ? hourLabel(hand.heading) : '?'
      return [{ offset: hand.offset, imageUrl, label }]
    })

  function lookTowards(offset: number) {
    setAngleOffset(offset)
    setStoryIndex(-1)
  }

  /** Walk through a link, taking along the way this view looks so the next location can answer it. */
  function followLinkTo(sceneId: string) {
    setTravelHeading(activeHand?.isSet ? activeHand.heading : null)
    goToScene(sceneId)
  }

  // A and D turn the camera as the on-screen arrows do. A picker on top of the scene is
  // its own conversation, so the keys stay out of it until it closes.
  useAngleKeys({
    enabled:
      storyIndex < 0 &&
      modalMode === null &&
      !storyModalOpen &&
      !angleModalOpen &&
      linkToDelete === null &&
      !isSubmitting,
    onLookLeft: () => leftOffset !== null && lookTowards(leftOffset),
    onLookRight: () => rightOffset !== null && lookTowards(rightOffset),
  })

  // W walks through the view's link, but only once it is on screen — at the end of the
  // story, as a click on the pin would.
  useLinkKey({
    enabled:
      showLinks &&
      followLink !== undefined &&
      modalMode === null &&
      !storyModalOpen &&
      !angleModalOpen &&
      linkToDelete === null &&
      !isSubmitting,
    onFollowLink: () => followLink && followLinkTo(followLink.toSceneId),
  })

  return (
    <div className="relative h-screen max-h-screen w-screen overflow-hidden bg-void">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-6 py-5">
        <Link
          to="/admin"
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-2 font-sans text-caption text-white/70 backdrop-blur-md transition hover:border-gold-bright hover:text-gold-bright"
        >
          <FiArrowLeft className="h-3.5 w-3.5" />
          {t.admin.editor.backToWorlds}
        </Link>

        <div className="pointer-events-auto flex items-center gap-4">
          <div className="text-right">
            <p className="font-display text-h2 font-[300] text-white/95">{t.admin.editor.openingTitle}</p>
            {worldName && <p className="font-sans text-caption text-mist">{worldName}</p>}
          </div>

          <Link
            to={`/admin/worlds/${worldId}/canvas`}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-2 font-sans text-caption text-white/70 backdrop-blur-md transition hover:border-gold-bright hover:text-gold-bright"
          >
            <FiGrid className="h-3.5 w-3.5" />
            {t.admin.editor.canvasButton}
          </Link>
        </div>
      </div>

      {hasNoScenes && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setModalMode('first-scene')}
            className="group flex flex-col items-center gap-4"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 transition group-hover:border-gold-bright group-hover:text-gold-bright">
              <FiImage className="h-8 w-8" />
            </span>
            <span className="font-display text-h2 font-[300] text-white/90 transition group-hover:text-gold-bright">
              {t.admin.editor.firstScenePrompt}
            </span>
          </button>
        </div>
      )}

      {currentScene && displayedImage && (
        <div ref={backgroundRef} className="relative h-full max-h-screen w-full">
          <img
            key={displayedImage}
            src={displayedImage}
            alt={currentScene.name}
            className="absolute inset-0 h-full max-h-screen w-full object-cover"
          />

          {showLinks &&
            viewLinks.map((link) => {
              const override = link.anglePositions?.[currentViewKey]
              return (
                <ScenePin
                  key={link.id}
                  link={link}
                  title={t.admin.editor.followLink.replace('{label}', link.label)}
                  position={{
                    x: override?.positionX ?? link.positionX,
                    y: override?.positionY ?? link.positionY,
                  }}
                  containerRef={backgroundRef}
                  onDragEnd={(linkId, x, y) => updateLinkPosition(linkId, activeOption, angleOffset, x, y)}
                  onNavigate={followLinkTo}
                />
              )
            })}

          {/* Turning left or right stays inside the same scene; each view shows its own link. */}
          {storyIndex < 0 && leftOffset !== null && (
            <button
              type="button"
              onClick={() => lookTowards(leftOffset)}
              title={`${t.admin.angle.lookLeft} (A)`}
              className="absolute left-6 top-1/2 z-20 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/80 backdrop-blur-md transition hover:border-gold-bright hover:text-gold-bright"
            >
              <FiArrowLeft className="h-6 w-6" />
            </button>
          )}

          {storyIndex < 0 && rightOffset !== null && (
            <button
              type="button"
              onClick={() => lookTowards(rightOffset)}
              title={`${t.admin.angle.lookRight} (D)`}
              className="absolute right-6 top-1/2 z-20 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/80 backdrop-blur-md transition hover:border-gold-bright hover:text-gold-bright"
            >
              <FiArrowRight className="h-6 w-6" />
            </button>
          )}

          <div className="absolute left-1/2 top-24 z-20 flex -translate-x-1/2 flex-col items-center gap-2.5">
            {options.length > 1 && (
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/50 p-2 backdrop-blur-md">
                {options.map((option) => {
                  const optionHasStory = Object.entries(currentScene.stories ?? {}).some(
                    ([key, frames]) => key.startsWith(`${option.key}#`) && frames.length > 0,
                  )
                  return (
                    <button
                      key={option.key}
                      type="button"
                      title={option.label}
                      onClick={() => {
                        setActiveOption(option.key)
                        setAngleOffset(0)
                        setStoryIndex(-1)
                      }}
                      className={`relative h-12 w-16 overflow-hidden rounded-lg border-2 transition ${
                        activeOption === option.key ? 'border-gold-bright' : 'border-transparent hover:border-white/25'
                      }`}
                    >
                      <img src={option.imageUrl} alt={option.label} className="h-full w-full object-cover" />
                      {optionHasStory && (
                        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold-bright">
                          <FiBookOpen className="h-2.5 w-2.5 text-abyss" />
                        </span>
                      )}
                      {/* The whole world flips at this minute, so it reads as the option's own stamp. */}
                      <span className="absolute inset-x-0 bottom-0 bg-black/70 py-px text-center font-mono text-micro tabular-nums text-white/85">
                        {formatClock(timeFor(option.optionIndex))}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Angles are views of one moment, so the schedule is only editable from the
                option's own image — not from a turned-away angle. */}
            {angleOffset === 0 && storyIndex < 0 && (
              <OptionTimeField
                // Another option is a different entry in the schedule, not a new value
                // for this one — the field starts clean rather than carrying state over.
                key={activeOptionIndex}
                optionIndex={activeOptionIndex}
                minuteOfDay={timeFor(activeOptionIndex)}
                onSave={(minuteOfDay) => setOptionTime(activeOptionIndex, minuteOfDay)}
              />
            )}
          </div>

          {/* Every view is an angle with an hour of its own; gold marks a magnetic one. */}
          <span className="absolute left-1/2 bottom-8 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 font-mono text-micro text-white/80 backdrop-blur-md">
            <FiCompass className={`h-3.5 w-3.5 ${activeHand?.magnetic ? 'text-gold-bright' : 'text-white/60'}`} />
            {t.admin.heading.angleHand}
            <span className="text-white/50">
              {activeHand?.isSet ? hourLabel(activeHand.heading) : t.admin.heading.notPicked}
            </span>
          </span>

          {canAdvance && (
            <button
              type="button"
              onClick={() => setStoryIndex((prev) => prev + 1)}
              className="absolute right-8 top-[calc(50%+5rem)] z-20 flex -translate-y-1/2 items-center gap-2 rounded-full bg-gradient-to-r from-gold to-gold-bright px-4 py-3 font-sans text-caption font-[700] text-abyss shadow-lg transition hover:brightness-105"
            >
              {t.admin.story.advance}
              <FiArrowRight className="h-4 w-4" />
            </button>
          )}

          {storyFrames.length > 0 && (
            <span className="absolute bottom-8 right-8 z-20 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 font-mono text-micro text-white/80 backdrop-blur-md">
              {t.admin.story.frameCounter
                .replace('{i}', String(storyIndex + 1))
                .replace('{n}', String(storyFrames.length))}
            </span>
          )}

          <div className="absolute bottom-6 left-6 z-20 flex flex-col items-start gap-1.5">
            {storyIndex < 0 && (
              <button
                type="button"
                onClick={() => setModalMode('change-image')}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-2 font-sans text-caption font-[700] text-white/80 backdrop-blur-md transition hover:border-gold-bright hover:text-gold-bright"
              >
                <FiRefreshCw className="h-3.5 w-3.5" />
                {t.admin.editor.changeSceneButton}
              </button>
            )}

            {/* Each view holds one link: an empty view offers to create it, a taken one
                to move it onto another angle or to remove it. */}
            {viewLinks.length === 0 ? (
              <button
                type="button"
                onClick={() => setModalMode('create-link')}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-gold to-gold-bright px-4 py-2 font-sans text-caption font-[700] text-abyss shadow-lg transition hover:brightness-105"
              >
                <FiPlusCircle className="h-3.5 w-3.5" />
                {t.admin.editor.createLinkButton}
              </button>
            ) : (
              <>
                <LinkMoveMenu
                  links={viewLinks}
                  allLinks={currentScene.links ?? []}
                  views={optionViews}
                  currentOffset={angleOffset}
                  disabled={isSubmitting}
                  onMove={handleLinkMove}
                />
                {/* One button per link — a scene from before one-link-per-view names them apart. */}
                {viewLinks.map((link) => (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => setLinkToDelete(link)}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-2 font-sans text-caption font-[700] text-white/60 backdrop-blur-md transition hover:border-red-400/60 hover:text-red-300 disabled:opacity-40"
                  >
                    <FiTrash2 className="h-3.5 w-3.5" />
                    {viewLinks.length === 1
                      ? t.admin.linkDelete.button
                      : t.admin.linkDelete.buttonNamed.replace('{label}', link.label)}
                  </button>
                ))}
              </>
            )}

            {/* Decides where someone walking in from another location ends up looking. A
                view with no heading on record has nowhere on the ring to pull towards. */}
            <button
              type="button"
              role="switch"
              aria-checked={activeHand?.magnetic ?? false}
              disabled={!activeHand?.isSet}
              title={activeHand?.isSet ? t.admin.magnet.hint : t.admin.magnet.needsHeading}
              onClick={() => setViewMagnetic(activeOption, angleOffset, !activeHand?.magnetic)}
              className={`flex items-center gap-2 rounded-full border bg-black/50 px-4 py-2 font-sans text-caption font-[700] backdrop-blur-md transition hover:border-gold-bright hover:text-gold-bright disabled:opacity-40 disabled:hover:border-white/15 disabled:hover:text-white/80 ${
                activeHand?.magnetic ? 'border-gold-bright text-gold-bright' : 'border-white/15 text-white/80'
              }`}
            >
              <LuMagnet className="h-3.5 w-3.5" />
              {t.admin.magnet.label}
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-micro ${
                  activeHand?.magnetic ? 'bg-gold-bright text-abyss' : 'bg-white/10 text-white/60'
                }`}
              >
                {activeHand?.magnetic ? t.admin.magnet.on : t.admin.magnet.off}
              </span>
            </button>

            {/* Options belong to the scene as a whole, so they are only offered from the
                option's own image, not from a turned-away angle. */}
            {angleOffset === 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setModalMode('create-variant')}
                  className="flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-2 font-sans text-caption font-[700] text-white/80 backdrop-blur-md transition hover:border-gold-bright hover:text-gold-bright"
                >
                  <FiCopy className="h-3.5 w-3.5" />
                  {t.admin.editor.createOptionButton}
                  {variantCount > 0 && (
                    <span className="rounded-full bg-gold-bright px-2 py-0.5 font-mono text-micro text-abyss">
                      {variantCount}
                    </span>
                  )}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setAngleModalOpen(true)}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-2 font-sans text-caption font-[700] text-white/80 backdrop-blur-md transition hover:border-gold-bright hover:text-gold-bright"
            >
              <FiCompass className="h-3.5 w-3.5" />
              {t.admin.editor.createAngleButton}
              {optionAngles.length > 0 && (
                <span className="rounded-full bg-gold-bright px-2 py-0.5 font-mono text-micro text-abyss">
                  {optionAngles.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setStoryModalOpen(true)}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-2 font-sans text-caption font-[700] text-white/80 backdrop-blur-md transition hover:border-gold-bright hover:text-gold-bright"
            >
              <FiBookOpen className="h-3.5 w-3.5" />
              {t.admin.editor.createStoryButton}
              {storyFrames.length > 0 && (
                <span className="rounded-full bg-gold-bright px-2 py-0.5 font-mono text-micro text-abyss">
                  {storyFrames.length}
                </span>
              )}
            </button>

            {angleOffset !== 0 && (
              <button
                type="button"
                onClick={handleAngleDelete}
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-2 font-sans text-caption font-[700] text-white/60 backdrop-blur-md transition hover:border-red-400/60 hover:text-red-300 disabled:opacity-40"
              >
                <FiTrash2 className="h-3.5 w-3.5" />
                {t.admin.angle.deleteButton}
              </button>
            )}
          </div>
        </div>
      )}

      <DeleteConnectionModal
        connection={
          linkToDelete && currentScene
            ? {
                title: t.admin.disconnect.linkTitle,
                question: t.admin.disconnect.linkQuestion
                  .replace('{a}', currentScene.name)
                  .replace('{b}', linkToDelete.toSceneName ?? linkToDelete.label),
                links: [
                  {
                    id: linkToDelete.id,
                    from: currentScene.name,
                    to: linkToDelete.toSceneName ?? linkToDelete.label,
                    label: linkToDelete.label,
                  },
                ],
                // Only this scene's links are loaded here, so whether there is a way back is not known.
                notes: [
                  t.admin.disconnect.linkBackMayStay.replace(
                    '{b}',
                    linkToDelete.toSceneName ?? linkToDelete.label,
                  ),
                ],
              }
            : null
        }
        isDeleting={isSubmitting}
        error={linkDeleteError}
        onConfirm={handleLinkDeleteConfirm}
        onCancel={closeLinkDelete}
      />

      <AnglePickerModal
        open={angleModalOpen}
        isSubmitting={isSubmitting}
        scope={{ worldId, kind: 'scene' }}
        hiddenUrls={usedUrls}
        hands={optionHands}
        onConfirm={handleAngleConfirm}
        onCancel={() => setAngleModalOpen(false)}
      />

      <StoryPickerModal
        open={storyModalOpen}
        isSubmitting={isSubmitting}
        scope={{ worldId, kind: 'scene' }}
        initialUrls={storyFrames.map((frame) => frame.imageUrl)}
        hiddenUrls={usedUrls}
        onConfirm={handleStoryConfirm}
        onCancel={() => setStoryModalOpen(false)}
      />

      <GalleryPickerModal
        scope={{ worldId, kind: 'scene' }}
        open={modalMode !== null}
        nameLabel={
          modalMode === 'create-variant' || modalMode === 'change-image'
            ? null
            : modalMode === 'first-scene'
              ? t.admin.editor.modal.sceneNameLabel
              : t.admin.editor.modal.linkNameLabel
        }
        hiddenUrls={usedUrls}
        // Both of these make a new scene, and a scene's image needs its direction.
        withHeading={modalMode === 'first-scene' || modalMode === 'create-link'}
        isSubmitting={isSubmitting}
        onConfirm={handleModalConfirm}
        onCancel={() => setModalMode(null)}
      />
    </div>
  )
}

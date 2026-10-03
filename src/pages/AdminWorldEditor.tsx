import { useEffect, useRef, useState } from 'react'
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
import { clamp } from '../utils/helpers'
import { formatClock } from '../utils/worldClock'
import { turnAngle, viewKey } from '../types/world'
import type { AngleDirection, SceneLink } from '../types/world'

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
    saveStory,
    changeViewImage,
    goToScene,
    moveLinkToAngle,
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const backgroundRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!worldId) return
    fetch(`/api/worlds/${worldId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setWorldName(data?.name ?? null))
      .catch(() => setWorldName(null))
  }, [worldId])

  const currentSceneId = currentScene?.id
  useEffect(() => {
    setActiveOption('base')
    setAngleOffset(0)
    setStoryIndex(-1)
  }, [currentSceneId])

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

  async function handleAngleConfirm(direction: AngleDirection, imageUrl: string) {
    setIsSubmitting(true)
    try {
      await createAngle(activeOption, angleOffset, direction, imageUrl)
      // Land on the angle that was just created, so it can be furnished right away.
      setAngleOffset((prev) => prev + (direction === 'right' ? 1 : -1))
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
      setAngleOffset(angleOffset - Math.sign(angleOffset))
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

  async function handleModalConfirm(name: string, imageUrl: string) {
    setIsSubmitting(true)
    try {
      if (modalMode === 'first-scene') {
        await createFirstScene(name, imageUrl)
      } else if (modalMode === 'create-link') {
        await createLink(name, imageUrl, angleOffset)
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

  // Angles are a chain hanging off the active option; offset 0 is the option image itself.
  const optionAngles = currentScene?.angles?.[activeOption] ?? []
  const activeAngle = optionAngles.find((angle) => angle.offset === angleOffset)
  const viewImage = angleOffset === 0 ? activeOptionImage : activeAngle?.imageUrl
  const hasAngleAt = (offset: number) =>
    offset === 0 || optionAngles.some((angle) => angle.offset === offset)
  const leftOffset = turnAngle(angleOffset, optionAngles, 'left')
  const rightOffset = turnAngle(angleOffset, optionAngles, 'right')
  // Turning wraps round the circle, but a new angle can only be hung off the open end of
  // the chain — a side that already has a neighbouring offset is taken.
  const takenDirections: AngleDirection[] = [
    ...(hasAngleAt(angleOffset - 1) ? (['left'] as const) : []),
    ...(hasAngleAt(angleOffset + 1) ? (['right'] as const) : []),
  ]

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
  // The option image and its angles in turning order — where a link can be moved to.
  const optionViews = [
    ...(activeOptionImage ? [{ offset: 0, imageUrl: activeOptionImage }] : []),
    ...optionAngles.map((angle) => ({ offset: angle.offset, imageUrl: angle.imageUrl })),
  ].sort((a, b) => a.offset - b.offset)

  function lookTowards(offset: number) {
    setAngleOffset(offset)
    setStoryIndex(-1)
  }

  // A and D turn the camera as the on-screen arrows do. A picker on top of the scene is
  // its own conversation, so the keys stay out of it until it closes.
  useAngleKeys({
    enabled: storyIndex < 0 && modalMode === null && !storyModalOpen && !angleModalOpen && !isSubmitting,
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
      !isSubmitting,
    onFollowLink: () => followLink && goToScene(followLink.toSceneId),
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
                  onNavigate={goToScene}
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

          {angleOffset !== 0 && (
            <span className="absolute left-1/2 bottom-8 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 font-mono text-micro text-white/80 backdrop-blur-md">
              <FiCompass className="h-3.5 w-3.5 text-gold-bright" />
              {t.admin.angle.counter.replace('{i}', angleOffset > 0 ? `+${angleOffset}` : String(angleOffset))}
            </span>
          )}

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
                to move it onto another angle. */}
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
              <LinkMoveMenu
                links={viewLinks}
                allLinks={currentScene.links ?? []}
                views={optionViews}
                currentOffset={angleOffset}
                disabled={isSubmitting}
                onMove={handleLinkMove}
              />
            )}

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

      <AnglePickerModal
        open={angleModalOpen}
        isSubmitting={isSubmitting}
        scope={{ worldId, kind: 'scene' }}
        hiddenUrls={usedUrls}
        takenDirections={takenDirections}
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
        isSubmitting={isSubmitting}
        onConfirm={handleModalConfirm}
        onCancel={() => setModalMode(null)}
      />
    </div>
  )
}

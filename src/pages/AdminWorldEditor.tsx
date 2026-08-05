import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FiArrowLeft, FiArrowRight, FiBookOpen, FiCopy, FiGrid, FiImage, FiPlusCircle, FiRefreshCw } from 'react-icons/fi'
import { useT } from '../i18n'
import { useWorldEditor } from '../hooks/useWorldEditor'
import { useUsedImages } from '../hooks/useUsedImages'
import GalleryPickerModal from '../components/admin/GalleryPickerModal'
import StoryPickerModal from '../components/admin/StoryPickerModal'
import { clamp } from '../utils/helpers'
import type { SceneLink } from '../types/world'

type ModalMode = 'first-scene' | 'create-link' | 'create-variant' | 'change-image' | null

interface ScenePinProps {
  link: SceneLink
  containerRef: React.RefObject<HTMLDivElement | null>
  onDragEnd: (linkId: string, x: number, y: number) => void
  onNavigate: (sceneId: string) => void
}

function ScenePin({ link, containerRef, onDragEnd, onNavigate }: ScenePinProps) {
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const pos = dragPos ?? { x: link.positionX, y: link.positionY }

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
    saveStory,
    changeOptionImage,
    goToScene,
    updateLinkPosition,
  } = useWorldEditor(worldId ?? '')
  const { usedUrls, refetchUsed } = useUsedImages(worldId ?? '')

  const [worldName, setWorldName] = useState<string | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  /** 'base' = the scene's own image, otherwise a variant id. */
  const [activeOption, setActiveOption] = useState<string>('base')
  /** -1 = showing the option image itself; 0..n-1 = story frame index. */
  const [storyIndex, setStoryIndex] = useState(-1)
  const [storyModalOpen, setStoryModalOpen] = useState(false)
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
    setStoryIndex(-1)
  }, [currentSceneId])

  async function handleStoryConfirm(imageUrls: string[]) {
    setIsSubmitting(true)
    try {
      await saveStory(activeOption, imageUrls)
      setStoryIndex(-1)
      await refetchUsed()
    } finally {
      setIsSubmitting(false)
      setStoryModalOpen(false)
    }
  }

  async function handleModalConfirm(name: string, imageUrl: string) {
    setIsSubmitting(true)
    try {
      if (modalMode === 'first-scene') {
        await createFirstScene(name, imageUrl)
      } else if (modalMode === 'create-link') {
        await createLink(name, imageUrl)
      } else if (modalMode === 'create-variant') {
        await createVariant(imageUrl)
      } else if (modalMode === 'change-image') {
        await changeOptionImage(activeOption, imageUrl)
      }
      await refetchUsed()
    } finally {
      setIsSubmitting(false)
      setModalMode(null)
    }
  }

  const hasNoScenes = !isLoading && scenes.length === 0
  const variantCount = currentScene?.variants?.length ?? 0

  // The option strip: the scene image first, then each variant in creation order.
  const options = currentScene
    ? [
        { key: 'base', imageUrl: currentScene.imageUrl, label: t.admin.editor.baseOption },
        ...(currentScene.variants ?? []).map((variant, index) => ({
          key: variant.id,
          imageUrl: variant.imageUrl,
          label: `${t.admin.editor.optionShort} ${index + 1}`,
        })),
      ]
    : []
  const activeOptionImage = options.find((option) => option.key === activeOption)?.imageUrl ?? currentScene?.imageUrl
  const storyFrames = currentScene?.stories?.[activeOption] ?? []
  // Advancing walks off the option image and through the story, stopping on the last frame.
  const displayedImage = storyIndex >= 0 ? storyFrames[storyIndex]?.imageUrl ?? activeOptionImage : activeOptionImage
  const canAdvance = storyFrames.length > 0 && storyIndex < storyFrames.length - 1
  // Links belong at the end of the narrative: with a story they surface on its last
  // frame, otherwise straight away on the option image.
  const showLinks = storyFrames.length === 0 ? storyIndex < 0 : storyIndex === storyFrames.length - 1

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

      {currentScene && (
        <div ref={backgroundRef} className="relative h-full max-h-screen w-full">
          <img
            key={displayedImage}
            src={displayedImage}
            alt={currentScene.name}
            className="absolute inset-0 h-full max-h-screen w-full object-cover"
          />

          {showLinks && (currentScene.links ?? []).map((link) => (
            <ScenePin
              key={link.id}
              link={link}
              containerRef={backgroundRef}
              onDragEnd={updateLinkPosition}
              onNavigate={goToScene}
            />
          ))}

          {options.length > 1 && (
            <div className="absolute left-1/2 top-24 z-20 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/10 bg-black/50 p-2 backdrop-blur-md">
              {options.map((option) => {
                const hasStory = (currentScene.stories?.[option.key]?.length ?? 0) > 0
                return (
                  <button
                    key={option.key}
                    type="button"
                    title={option.label}
                    onClick={() => {
                      setActiveOption(option.key)
                      setStoryIndex(-1)
                    }}
                    className={`relative h-12 w-16 overflow-hidden rounded-lg border-2 transition ${
                      activeOption === option.key ? 'border-gold-bright' : 'border-transparent hover:border-white/25'
                    }`}
                  >
                    <img src={option.imageUrl} alt={option.label} className="h-full w-full object-cover" />
                    {hasStory && (
                      <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold-bright">
                        <FiBookOpen className="h-2.5 w-2.5 text-abyss" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {canAdvance && (
            <button
              type="button"
              onClick={() => setStoryIndex((prev) => prev + 1)}
              className="absolute right-8 top-1/2 z-20 flex -translate-y-1/2 items-center gap-2 rounded-full bg-gradient-to-r from-gold to-gold-bright px-4 py-3 font-sans text-caption font-[700] text-abyss shadow-lg transition hover:brightness-105"
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

            <button
              type="button"
              onClick={() => setModalMode('create-link')}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-gold to-gold-bright px-4 py-2 font-sans text-caption font-[700] text-abyss shadow-lg transition hover:brightness-105"
            >
              <FiPlusCircle className="h-3.5 w-3.5" />
              {t.admin.editor.createLinkButton}
            </button>

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
          </div>
        </div>
      )}

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

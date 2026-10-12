import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FiChevronLeft, FiChevronRight, FiClock, FiX } from 'react-icons/fi'
import { useGalleryImages, type GalleryScope } from '../../hooks/useGalleryImages'
import { useT } from '../../i18n'
import { formatClock, parseClock } from '../../utils/worldClock'
import PickerGrid from './PickerGrid'
import PickerUpload from './PickerUpload'
import type { GalleryImage } from '../../types/world'

interface StoryPickerModalProps {
  open: boolean
  isSubmitting: boolean
  /** Which image library to pick from — the world's scene assets. */
  scope: GalleryScope
  /** Existing story, so reopening the picker shows the current order. */
  initialUrls?: string[]
  /** The existing story's trigger time, as a minute of the day; null is none. */
  initialTriggerMinute?: number | null
  /** Images already used elsewhere in this world — hidden from the grid. */
  hiddenUrls?: string[]
  onConfirm: (imageUrls: string[], triggerMinute: number | null) => void
  onCancel: () => void
}

export default function StoryPickerModal({
  open,
  isSubmitting,
  scope,
  initialUrls = [],
  initialTriggerMinute = null,
  hiddenUrls = [],
  onConfirm,
  onCancel,
}: StoryPickerModalProps) {
  const t = useT()
  const { images, refetch } = useGalleryImages(scope)
  const [selected, setSelected] = useState<string[]>([])
  /** The trigger time as typed; empty is a story the player starts. */
  const [triggerDraft, setTriggerDraft] = useState('')
  const [triggerInvalid, setTriggerInvalid] = useState(false)
  /** The frame being dragged along the order strip, by its place in it. */
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  // Each picker keeps its own copy of the library, so what was uploaded from another
  // one — or from the assets page — only shows up here once this one looks again.
  useEffect(() => {
    if (open) refetch()
  }, [open, refetch])

  /** Images uploaded from here join the story, after the frames already chosen. */
  async function handleUploaded(created: GalleryImage[]) {
    await refetch()
    setSelected((prev) => [...prev, ...created.map((image) => image.url).filter((url) => !prev.includes(url))])
  }

  async function handleDeleted(deleted: GalleryImage) {
    await refetch()
    setSelected((prev) => prev.filter((url) => url !== deleted.url))
  }

  // Hide what the rest of the world already uses, but always keep this story's own
  // frames visible so the current order stays editable.
  const keep = new Set(initialUrls)
  const hiddenSet = new Set(hiddenUrls.filter((url) => !keep.has(url)))
  const available = images.filter((image) => !hiddenSet.has(image.url))

  // Seed the running order and the trigger time from the saved story each time the
  // picker opens.
  useEffect(() => {
    if (!open) return
    setSelected(initialUrls)
    setTriggerDraft(initialTriggerMinute === null ? '' : formatClock(initialTriggerMinute))
    setTriggerInvalid(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function toggle(url: string) {
    setSelected((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]))
  }

  /** Move the frame at `from` to `to` in the running order, shifting the ones between. */
  function move(from: number, to: number) {
    setSelected((prev) => {
      if (from === to || to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [url] = next.splice(from, 1)
      next.splice(to, 0, url)
      return next
    })
  }

  function handleConfirm() {
    const typed = triggerDraft.trim()
    const triggerMinute = typed === '' ? null : parseClock(typed)
    if (typed !== '' && triggerMinute === null) {
      setTriggerInvalid(true)
      return
    }
    // A story without frames is no story, so it keeps no time either.
    onConfirm(selected, selected.length > 0 ? triggerMinute : null)
  }

  function handleClose() {
    onCancel()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-abyss"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h3 className="font-display text-h2 font-[300] text-white/95">{t.admin.story.modalTitle}</h3>
                <p className="font-sans text-caption text-mist">{t.admin.story.modalSubtitle}</p>
              </div>
              <button type="button" onClick={handleClose} className="text-white/50 transition hover:text-white">
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <PickerUpload scope={scope} onUploaded={handleUploaded} />

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <PickerGrid
                images={available}
                libraryEmpty={images.length === 0}
                selectedUrls={selected}
                numbered
                onPick={(image) => toggle(image.url)}
                onDeleted={handleDeleted}
              />
            </div>

            {/* The story in the order it will play. A frame is dragged to its new place,
                or nudged one step with its arrows. */}
            <div className="border-t border-white/10 px-6 py-4">
              <p className="mb-2 font-sans text-micro uppercase tracking-[0.14em] text-white/50">
                {t.admin.story.orderTitle}
              </p>
              {selected.length === 0 ? (
                <p className="font-sans text-caption text-mist">{t.admin.story.orderEmpty}</p>
              ) : (
                <ol className="flex gap-3 overflow-x-auto pb-1">
                  {selected.map((url, index) => (
                    <li
                      key={url}
                      draggable
                      onDragStart={(event) => {
                        setDragIndex(index)
                        event.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragOver={(event) => {
                        if (dragIndex === null) return
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'move'
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        if (dragIndex !== null) move(dragIndex, index)
                        setDragIndex(null)
                      }}
                      onDragEnd={() => setDragIndex(null)}
                      className={`group relative w-28 shrink-0 cursor-grab overflow-hidden rounded-lg border bg-black/40 transition active:cursor-grabbing ${
                        dragIndex === index ? 'border-gold-bright opacity-50' : 'border-white/15'
                      }`}
                    >
                      <img src={url} alt="" draggable={false} className="aspect-video w-full object-cover" />
                      <span className="absolute left-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-bright px-1.5 font-mono text-micro font-[800] text-abyss">
                        {index + 1}
                      </span>
                      <button
                        type="button"
                        title={t.admin.story.remove}
                        onClick={() => toggle(url)}
                        className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white/70 opacity-0 transition hover:text-white group-hover:opacity-100"
                      >
                        <FiX className="h-3 w-3" />
                      </button>
                      <div className="flex items-center justify-between px-1 py-1">
                        <button
                          type="button"
                          title={t.admin.story.moveEarlier}
                          onClick={() => move(index, index - 1)}
                          disabled={index === 0}
                          className="rounded p-0.5 text-white/60 transition hover:text-gold-bright disabled:opacity-20"
                        >
                          <FiChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title={t.admin.story.moveLater}
                          onClick={() => move(index, index + 1)}
                          disabled={index === selected.length - 1}
                          className="rounded p-0.5 text-white/60 transition hover:text-gold-bright disabled:opacity-20"
                        >
                          <FiChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* When the story plays by itself on this view. */}
            <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-6 py-4">
              <div
                className={`flex items-center gap-2 rounded-full border bg-black/40 px-3 py-1.5 transition ${
                  triggerInvalid ? 'border-red-400/70' : 'border-white/15'
                }`}
              >
                <FiClock className="h-3.5 w-3.5 text-gold-bright" />
                <span className="font-sans text-micro uppercase tracking-[0.14em] text-white/50">
                  {t.admin.story.trigger.label}
                </span>
                <input
                  value={triggerDraft}
                  onChange={(event) => {
                    setTriggerDraft(event.target.value)
                    setTriggerInvalid(false)
                  }}
                  onBlur={() => {
                    // Normalise what was typed ('1210', '12.10') to how the clock reads it.
                    const parsed = parseClock(triggerDraft)
                    if (parsed !== null) setTriggerDraft(formatClock(parsed))
                    else if (triggerDraft.trim() !== '') setTriggerInvalid(true)
                  }}
                  placeholder={t.admin.story.trigger.placeholder}
                  inputMode="numeric"
                  maxLength={5}
                  className="w-14 rounded-md border border-white/10 bg-black/40 px-2 py-0.5 text-center font-mono text-caption font-[700] tabular-nums text-white/95 outline-none transition focus:border-gold-bright"
                />
                {triggerDraft !== '' && (
                  <button
                    type="button"
                    title={t.admin.story.trigger.clear}
                    onClick={() => {
                      setTriggerDraft('')
                      setTriggerInvalid(false)
                    }}
                    className="text-white/50 transition hover:text-white"
                  >
                    <FiX className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <span className={`flex-1 font-sans text-micro ${triggerInvalid ? 'text-red-300' : 'text-mist'}`}>
                {triggerInvalid ? t.admin.story.trigger.invalid : t.admin.story.trigger.hint}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/10 px-6 py-4">
              <span className="font-mono text-micro text-mist">
                {selected.length > 0
                  ? t.admin.story.selectedCount.replace('{n}', String(selected.length))
                  : t.admin.story.selectHint}
              </span>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl border border-white/15 px-5 py-3 font-sans text-body text-white/70 transition hover:border-white/30"
                >
                  {t.admin.story.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className="rounded-xl bg-gradient-to-r from-gold to-gold-bright px-5 py-3 font-sans text-body font-[700] text-abyss transition disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSubmitting ? t.admin.editor.creating : t.admin.story.confirm}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

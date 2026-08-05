import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FiX } from 'react-icons/fi'
import { useGalleryImages, type GalleryScope } from '../../hooks/useGalleryImages'
import { useT } from '../../i18n'

interface StoryPickerModalProps {
  open: boolean
  isSubmitting: boolean
  /** Which image library to pick from — the world's scene assets. */
  scope: GalleryScope
  /** Existing story, so reopening the picker shows the current order. */
  initialUrls?: string[]
  /** Images already used elsewhere in this world — hidden from the grid. */
  hiddenUrls?: string[]
  onConfirm: (imageUrls: string[]) => void
  onCancel: () => void
}

export default function StoryPickerModal({
  open,
  isSubmitting,
  scope,
  initialUrls = [],
  hiddenUrls = [],
  onConfirm,
  onCancel,
}: StoryPickerModalProps) {
  const t = useT()
  const { images } = useGalleryImages(scope)
  const [selected, setSelected] = useState<string[]>([])

  // Hide what the rest of the world already uses, but always keep this story's own
  // frames visible so the current order stays editable.
  const keep = new Set(initialUrls)
  const hiddenSet = new Set(hiddenUrls.filter((url) => !keep.has(url)))
  const available = images.filter((image) => !hiddenSet.has(image.url))

  // Seed the running order from the saved story each time the picker opens.
  useEffect(() => {
    if (open) setSelected(initialUrls)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function toggle(url: string) {
    setSelected((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]))
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

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {available.length === 0 ? (
                <p className="font-sans text-caption text-mist">
                  {images.length === 0 ? t.admin.editor.modal.empty : t.admin.editor.modal.allUsed}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                  {available.map((image) => {
                    const order = selected.indexOf(image.url)
                    const isSelected = order !== -1
                    return (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => toggle(image.url)}
                        className={`relative overflow-hidden rounded-xl border-2 transition ${
                          isSelected ? 'border-gold-bright' : 'border-transparent hover:border-white/20'
                        }`}
                      >
                        <img
                          src={image.url}
                          alt={image.originalName}
                          className="aspect-square w-full object-cover"
                        />
                        {isSelected && (
                          <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gold-bright font-mono text-caption font-[700] text-abyss">
                            {order + 1}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
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
                  onClick={() => onConfirm(selected)}
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

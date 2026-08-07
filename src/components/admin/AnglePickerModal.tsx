import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FiArrowLeft, FiArrowRight, FiChevronLeft, FiX } from 'react-icons/fi'
import { useGalleryImages, type GalleryScope } from '../../hooks/useGalleryImages'
import { useT } from '../../i18n'
import type { AngleDirection } from '../../types/world'

interface AnglePickerModalProps {
  open: boolean
  isSubmitting: boolean
  /** Which image library to pick from. */
  scope: GalleryScope
  /** Image URLs already used in this world — hidden from the grid entirely. */
  hiddenUrls?: string[]
  /** Directions that already have an angle hanging off the current view. */
  takenDirections?: AngleDirection[]
  onConfirm: (direction: AngleDirection, imageUrl: string) => void
  onCancel: () => void
}

/**
 * Two steps, in this order: which way you turn, then what you see there. The direction
 * comes first because it is the thing that decides where the new angle lands.
 */
export default function AnglePickerModal({
  open,
  isSubmitting,
  scope,
  hiddenUrls = [],
  takenDirections = [],
  onConfirm,
  onCancel,
}: AnglePickerModalProps) {
  const t = useT()
  const { images } = useGalleryImages(scope)
  const [direction, setDirection] = useState<AngleDirection | null>(null)
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)

  const hiddenSet = new Set(hiddenUrls)
  const available = images.filter((image) => !hiddenSet.has(image.url))

  function handleClose() {
    setDirection(null)
    setSelectedUrl(null)
    onCancel()
  }

  function handleConfirm() {
    if (!direction || !selectedUrl) return
    onConfirm(direction, selectedUrl)
    setDirection(null)
    setSelectedUrl(null)
  }

  const directions: { value: AngleDirection; icon: typeof FiArrowLeft; label: string }[] = [
    { value: 'left', icon: FiArrowLeft, label: t.admin.angle.left },
    { value: 'right', icon: FiArrowRight, label: t.admin.angle.right },
  ]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-md"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-abyss backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-3">
                {direction && (
                  <button
                    type="button"
                    onClick={() => {
                      setDirection(null)
                      setSelectedUrl(null)
                    }}
                    className="text-white/50 transition hover:text-white"
                    title={t.admin.angle.backToDirection}
                  >
                    <FiChevronLeft className="h-5 w-5" />
                  </button>
                )}
                <div>
                  <h3 className="font-display text-h2 font-[300] text-white/95">{t.admin.angle.modalTitle}</h3>
                  <p className="font-sans text-caption text-mist">
                    {direction ? t.admin.angle.stepImage : t.admin.angle.stepDirection}
                  </p>
                </div>
              </div>
              <button type="button" onClick={handleClose} className="text-white/50 transition hover:text-white">
                <FiX className="h-5 w-5" />
              </button>
            </div>

            {!direction ? (
              <div className="flex flex-1 items-center justify-center gap-5 px-6 py-10">
                {directions.map(({ value, icon: Icon, label }) => {
                  const taken = takenDirections.includes(value)
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={taken}
                      onClick={() => setDirection(value)}
                      title={taken ? t.admin.angle.alreadyTaken : label}
                      className="group flex w-40 flex-col items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.03] px-6 py-8 transition enabled:hover:border-gold-bright enabled:hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Icon className="h-10 w-10 text-white/70 transition group-enabled:group-hover:text-gold-bright" />
                      <span className="font-sans text-caption font-[700] text-white/80 transition group-enabled:group-hover:text-gold-bright">
                        {label}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {available.length === 0 ? (
                  <p className="font-sans text-caption text-mist">
                    {images.length === 0 ? t.admin.editor.modal.empty : t.admin.editor.modal.allUsed}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                    {available.map((image) => {
                      const isSelected = selectedUrl === image.url
                      return (
                        <button
                          key={image.id}
                          type="button"
                          onClick={() => setSelectedUrl(image.url)}
                          className={`relative overflow-hidden rounded-xl border-2 transition ${
                            isSelected ? 'border-gold-bright' : 'border-transparent hover:border-white/20'
                          }`}
                        >
                          <img
                            src={image.url}
                            alt={image.originalName}
                            className="aspect-square w-full object-cover"
                          />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 border-t border-white/10 px-6 py-4">
              <div className="flex-1" />
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-white/15 px-5 py-3 font-sans text-body text-white/70 transition hover:border-white/30"
              >
                {t.admin.editor.modal.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!direction || !selectedUrl || isSubmitting}
                className="rounded-xl bg-gradient-to-r from-gold to-gold-bright px-5 py-3 font-sans text-body font-[700] text-abyss transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting ? t.admin.editor.creating : t.admin.angle.confirm}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

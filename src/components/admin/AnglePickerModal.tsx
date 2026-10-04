import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FiX } from 'react-icons/fi'
import { useGalleryImages, type GalleryScope } from '../../hooks/useGalleryImages'
import { useT } from '../../i18n'
import HeadingDial from './HeadingDial'
import MagnetToggle from './MagnetToggle'
import PickerGrid from './PickerGrid'
import PickerUpload from './PickerUpload'
import type { GalleryImage } from '../../types/world'
import type { RingHand } from '../../utils/heading'

interface AnglePickerModalProps {
  open: boolean
  isSubmitting: boolean
  /** Which image library to pick from. */
  scope: GalleryScope
  /** Image URLs already used in this world — hidden from the grid entirely. */
  hiddenUrls?: string[]
  /** The hands already on this option's ring: its own image and its angles. */
  hands?: RingHand[]
  onConfirm: (imageUrl: string, heading: number, magnetic: boolean) => void
  onCancel: () => void
}

/**
 * What the new angle shows and which way it looks. The hand on the dial is all that
 * places the angle: where it points decides where it comes round when turning.
 */
export default function AnglePickerModal({
  open,
  isSubmitting,
  scope,
  hiddenUrls = [],
  hands = [],
  onConfirm,
  onCancel,
}: AnglePickerModalProps) {
  const t = useT()
  const { images, refetch } = useGalleryImages(scope)
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)

  // Each picker keeps its own copy of the library, so what was uploaded from another
  // one — or from the assets page — only shows up here once this one looks again.
  useEffect(() => {
    if (open) refetch()
  }, [open, refetch])

  /** An image uploaded from here is the one being picked — a batch selects its first. */
  async function handleUploaded(created: GalleryImage[]) {
    await refetch()
    setSelectedUrl(created[0].url)
  }

  async function handleDeleted(deleted: GalleryImage) {
    await refetch()
    setSelectedUrl((prev) => (prev === deleted.url ? null : prev))
  }
  /** Null until the hand is pointed somewhere — an angle cannot be added without it. */
  const [heading, setHeading] = useState<number | null>(null)
  const [magnetic, setMagnetic] = useState(false)

  const hiddenSet = new Set(hiddenUrls)
  const available = images.filter((image) => !hiddenSet.has(image.url))

  function reset() {
    setSelectedUrl(null)
    setHeading(null)
    setMagnetic(false)
  }

  function handleClose() {
    reset()
    onCancel()
  }

  function handleConfirm() {
    if (!selectedUrl || heading === null) return
    onConfirm(selectedUrl, heading, magnetic)
    reset()
  }

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
            className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-abyss backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h3 className="font-display text-h2 font-[300] text-white/95">{t.admin.angle.modalTitle}</h3>
                <p className="font-sans text-caption text-mist">{t.admin.angle.modalSubtitle}</p>
              </div>
              <button type="button" onClick={handleClose} className="text-white/50 transition hover:text-white">
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <PickerUpload scope={scope} onUploaded={handleUploaded} />

            <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <PickerGrid
                  images={available}
                  libraryEmpty={images.length === 0}
                  selectedUrls={selectedUrl ? [selectedUrl] : []}
                  onPick={(image) => setSelectedUrl(image.url)}
                  onDeleted={handleDeleted}
                />
              </div>

              <aside className="flex shrink-0 flex-col gap-5 overflow-y-auto border-t border-white/10 px-6 py-5 sm:w-64 sm:border-l sm:border-t-0">
                <HeadingDial
                  value={heading}
                  others={hands}
                  magnetic={magnetic}
                  hint={t.admin.heading.angleHint}
                  onChange={setHeading}
                />
                <MagnetToggle checked={magnetic} onChange={setMagnetic} />
              </aside>
            </div>

            <div className="flex items-center gap-3 border-t border-white/10 px-6 py-4">
              <p className="flex-1 font-sans text-caption text-gold-bright/80">
                {heading === null ? t.admin.heading.required : ''}
              </p>
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
                disabled={!selectedUrl || heading === null || isSubmitting}
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

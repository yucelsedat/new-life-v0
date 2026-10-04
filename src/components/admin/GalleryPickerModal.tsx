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

interface GalleryPickerModalProps {
  open: boolean
  /** Label for the name input. Pass null to hide the name field entirely. */
  nameLabel: string | null
  isSubmitting: boolean
  /** Image URLs already used in this world — hidden from the grid entirely. */
  hiddenUrls?: string[]
  /** Which image library to pick from. */
  scope: GalleryScope
  /**
   * Set when the image becomes a new scene: it then needs the direction it looks in and
   * whether it is magnetic, picked beside the grid and handed to onConfirm.
   */
  withHeading?: boolean
  onConfirm: (name: string, imageUrl: string, heading: number, magnetic: boolean) => void
  onCancel: () => void
}

export default function GalleryPickerModal({
  open,
  nameLabel,
  isSubmitting,
  hiddenUrls = [],
  scope,
  withHeading = false,
  onConfirm,
  onCancel,
}: GalleryPickerModalProps) {
  const t = useT()
  const { images, refetch } = useGalleryImages(scope)
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)
  const [name, setName] = useState('')

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
  // A new location's first hand starts at 12 and is turned from there.
  const [heading, setHeading] = useState(0)
  const [magnetic, setMagnetic] = useState(false)

  const needsName = nameLabel !== null
  const hiddenSet = new Set(hiddenUrls)
  const available = images.filter((image) => !hiddenSet.has(image.url))

  function handleClose() {
    setSelectedUrl(null)
    setName('')
    setHeading(0)
    setMagnetic(false)
    onCancel()
  }

  function handleConfirm() {
    if (!selectedUrl) return
    if (needsName && !name.trim()) return
    onConfirm(name.trim(), selectedUrl, heading, magnetic)
    setSelectedUrl(null)
    setName('')
    setHeading(0)
    setMagnetic(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-6"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
            className={`flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-abyss backdrop-blur-2xl ${
              withHeading ? 'max-w-4xl' : 'max-w-3xl'
            }`}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h3 className="font-display text-h2 font-[300] text-white/95">{t.admin.editor.modal.chooseImage}</h3>
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

              {withHeading && (
                <aside className="flex shrink-0 flex-col gap-5 overflow-y-auto border-t border-white/10 px-6 py-5 sm:w-64 sm:border-l sm:border-t-0">
                  <HeadingDial
                    value={heading}
                    magnetic={magnetic}
                    hint={t.admin.heading.sceneHint}
                    onChange={setHeading}
                  />
                  <MagnetToggle checked={magnetic} onChange={setMagnetic} />
                </aside>
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-white/10 px-6 py-4">
              {needsName ? (
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="font-sans text-caption font-[700] text-white/70">{nameLabel}</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t.admin.editor.modal.namePlaceholder}
                    className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 font-sans text-body text-white/90 outline-none transition focus:border-gold-bright"
                  />
                </label>
              ) : (
                <div className="flex-1" />
              )}

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
                disabled={!selectedUrl || (needsName && !name.trim()) || isSubmitting}
                className="rounded-xl bg-gradient-to-r from-gold to-gold-bright px-5 py-3 font-sans text-body font-[700] text-abyss transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting ? t.admin.editor.creating : t.admin.editor.modal.confirm}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

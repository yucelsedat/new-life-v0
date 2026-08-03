import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FiX } from 'react-icons/fi'
import { useGalleryImages } from '../../hooks/useGalleryImages'
import { useT } from '../../i18n'

interface GalleryPickerModalProps {
  open: boolean
  nameLabel: string
  isSubmitting: boolean
  onConfirm: (name: string, imageUrl: string) => void
  onCancel: () => void
}

export default function GalleryPickerModal({ open, nameLabel, isSubmitting, onConfirm, onCancel }: GalleryPickerModalProps) {
  const t = useT()
  const { images } = useGalleryImages()
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)
  const [name, setName] = useState('')

  function handleClose() {
    setSelectedUrl(null)
    setName('')
    onCancel()
  }

  function handleConfirm() {
    if (!selectedUrl || !name.trim()) return
    onConfirm(name.trim(), selectedUrl)
    setSelectedUrl(null)
    setName('')
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
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-abyss backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h3 className="font-display text-h2 font-[300] text-white/95">{t.admin.editor.modal.chooseImage}</h3>
              <button type="button" onClick={handleClose} className="text-white/50 transition hover:text-white">
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {images.length === 0 ? (
                <p className="font-sans text-caption text-mist">{t.admin.editor.modal.empty}</p>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                  {images.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setSelectedUrl(image.url)}
                      className={`overflow-hidden rounded-xl border-2 transition ${
                        selectedUrl === image.url ? 'border-gold-bright' : 'border-transparent hover:border-white/20'
                      }`}
                    >
                      <img src={image.url} alt={image.originalName} className="aspect-square w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-white/10 px-6 py-4">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="font-sans text-caption font-[700] text-white/70">{nameLabel}</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t.admin.editor.modal.namePlaceholder}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 font-sans text-body text-white/90 outline-none transition focus:border-gold-bright"
                />
              </label>

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
                disabled={!selectedUrl || !name.trim() || isSubmitting}
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

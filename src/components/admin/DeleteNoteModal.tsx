import { AnimatePresence, motion } from 'framer-motion'
import { FiAlertTriangle, FiX } from 'react-icons/fi'
import { useT } from '../../i18n'

interface DeleteNoteModalProps {
  /** The note's title, or null when the dialog is closed. */
  noteTitle: string | null
  isDeleting: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteNoteModal({
  noteTitle,
  isDeleting,
  error,
  onConfirm,
  onCancel,
}: DeleteNoteModalProps) {
  const t = useT()

  return (
    <AnimatePresence>
      {noteTitle !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            onClick={(event) => event.stopPropagation()}
            className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-[#e0798f]/25 bg-abyss p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e0798f]/15 text-[#e0798f]">
                  <FiAlertTriangle className="h-5 w-5" />
                </span>
                <h3 className="font-display text-h2 font-[300] text-white/95">{t.admin.notes.deleteTitle}</h3>
              </div>
              <button type="button" onClick={onCancel} className="text-white/50 transition hover:text-white">
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <p className="font-sans text-body text-white/85">
                {t.admin.notes.deleteQuestion.replace('{name}', noteTitle)}
              </p>
              <p className="font-sans text-caption font-[700] text-[#e0798f]">{t.admin.notes.deleteIrreversible}</p>
              {error && <p className="font-sans text-caption text-[#e0798f]">{error}</p>}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-white/15 px-5 py-3 font-sans text-body text-white/70 transition hover:border-white/30"
              >
                {t.admin.notes.cancelButton}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isDeleting}
                className="rounded-xl bg-[#e0798f] px-5 py-3 font-sans text-body font-[700] text-abyss transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDeleting ? t.admin.notes.deleting : t.admin.notes.deleteConfirm}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

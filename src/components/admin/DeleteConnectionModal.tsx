import { AnimatePresence, motion } from 'framer-motion'
import { FiAlertTriangle, FiX } from 'react-icons/fi'
import { useT } from '../../i18n'

/**
 * What a deletion on the canvas takes away, spelled out for the dialog: a whole
 * connection between two scenes, or a single link of one.
 */
export interface ConnectionToDelete {
  title: string
  question: string
  /** The links that go. */
  links: { id: string; from: string; to: string; label: string }[]
  /** Anything worth knowing beforehand: what stays, and what is left unconnected. */
  notes: string[]
}

interface DeleteConnectionModalProps {
  /** The connection about to go, or null when the dialog is closed. */
  connection: ConnectionToDelete | null
  isDeleting: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteConnectionModal({
  connection,
  isDeleting,
  error,
  onConfirm,
  onCancel,
}: DeleteConnectionModalProps) {
  const t = useT()

  return (
    <AnimatePresence>
      {connection !== null && (
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
                <h3 className="font-display text-h2 font-[300] text-white/95">{connection.title}</h3>
              </div>
              <button type="button" onClick={onCancel} className="text-white/50 transition hover:text-white">
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <p className="font-sans text-body text-white/85">{connection.question}</p>

              <div className="flex flex-col gap-1.5">
                <span className="font-sans text-caption font-[700] text-white/70">{t.admin.disconnect.willDelete}</span>
                <ul className="flex flex-col rounded-xl border border-white/10 bg-white/5 px-3.5 py-1">
                  {connection.links.map((link) => (
                    <li
                      key={link.id}
                      className="flex items-baseline justify-between gap-3 border-t border-white/10 py-1.5 first:border-t-0"
                    >
                      <span className="min-w-0 truncate font-sans text-caption font-[700] text-white/90">
                        {link.from} → {link.to}
                      </span>
                      {/* A link is usually named after where it leads; only a name of its own is worth showing. */}
                      {link.label !== link.to && (
                        <span className="shrink-0 font-mono text-micro text-mist">{link.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {connection.notes.map((note) => (
                <p key={note} className="font-sans text-caption text-white/70">
                  {note}
                </p>
              ))}
              <p className="font-sans text-caption font-[700] text-[#e0798f]">{t.admin.disconnect.irreversible}</p>
              {error && <p className="font-sans text-caption text-[#e0798f]">{error}</p>}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-white/15 px-5 py-3 font-sans text-body text-white/70 transition hover:border-white/30"
              >
                {t.admin.disconnect.cancel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isDeleting}
                className="rounded-xl bg-[#e0798f] px-5 py-3 font-sans text-body font-[700] text-abyss transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDeleting ? t.admin.disconnect.deleting : t.admin.disconnect.confirm}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

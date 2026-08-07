import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FiAlertTriangle, FiX } from 'react-icons/fi'
import { useT } from '../../i18n'

export interface DeletionSummary {
  worldName: string
  scenes: number
  links: number
  variants: number
  angles: number
  storyFrames: number
  images: number
  notes: number
}

interface DeleteWorldModalProps {
  worldId: string | null
  onClose: () => void
  onDeleted: () => void
}

export default function DeleteWorldModal({ worldId, onClose, onDeleted }: DeleteWorldModalProps) {
  const t = useT()
  const [summary, setSummary] = useState<DeletionSummary | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!worldId) {
      setSummary(null)
      setError(null)
      return
    }

    let cancelled = false
    fetch(`/api/worlds/${worldId}/deletion-summary`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setSummary(data as DeletionSummary | null)
      })
      .catch(() => {
        if (!cancelled) setSummary(null)
      })

    return () => {
      cancelled = true
    }
  }, [worldId])

  async function handleConfirm() {
    if (!worldId) return
    setIsDeleting(true)
    setError(null)
    try {
      const response = await fetch(`/api/worlds/${worldId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      onDeleted()
      onClose()
    } catch {
      setError(t.admin.deleteWorld.error)
    } finally {
      setIsDeleting(false)
    }
  }

  const consequences = summary
    ? ([
        [summary.scenes, t.admin.deleteWorld.scenes],
        [summary.links, t.admin.deleteWorld.links],
        [summary.variants, t.admin.deleteWorld.variants],
        [summary.angles, t.admin.deleteWorld.angles],
        [summary.storyFrames, t.admin.deleteWorld.storyFrames],
        [summary.images, t.admin.deleteWorld.images],
        [summary.notes, t.admin.deleteWorld.notes],
      ] as const).filter(([count]) => count > 0)
    : []

  return (
    <AnimatePresence>
      {worldId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
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
                <h3 className="font-display text-h2 font-[300] text-white/95">{t.admin.deleteWorld.title}</h3>
              </div>
              <button type="button" onClick={onClose} className="text-white/50 transition hover:text-white">
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <p className="font-sans text-body text-white/85">
                {t.admin.deleteWorld.question.replace('{name}', summary?.worldName ?? '…')}
              </p>

              {consequences.length > 0 ? (
                <div>
                  <p className="font-sans text-caption text-mist">{t.admin.deleteWorld.willDelete}</p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {consequences.map(([count, label]) => (
                      <li key={label} className="font-sans text-caption text-white/80">
                        <span className="font-mono text-gold-bright">{count}</span> {label}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                summary && <p className="font-sans text-caption text-mist">{t.admin.deleteWorld.nothingElse}</p>
              )}

              <p className="font-sans text-caption font-[700] text-[#e0798f]">{t.admin.deleteWorld.irreversible}</p>
              {error && <p className="font-sans text-caption text-[#e0798f]">{error}</p>}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/15 px-5 py-3 font-sans text-body text-white/70 transition hover:border-white/30"
              >
                {t.admin.deleteWorld.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isDeleting || !summary}
                className="rounded-xl bg-[#e0798f] px-5 py-3 font-sans text-body font-[700] text-abyss transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDeleting ? t.admin.deleteWorld.deleting : t.admin.deleteWorld.confirm}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

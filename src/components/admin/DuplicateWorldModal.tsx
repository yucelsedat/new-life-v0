import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FiCopy, FiX } from 'react-icons/fi'
import type { World } from '../../types/world'
import { useT } from '../../i18n'

interface DuplicateWorldModalProps {
  world: World | null
  onClose: () => void
  onDuplicated: () => void
}

interface DuplicateWorldDialogProps {
  world: World
  onClose: () => void
  onDuplicated: () => void
}

/** Mounted once per opening, so the name field always starts from the world being copied. */
function DuplicateWorldDialog({ world, onClose, onDuplicated }: DuplicateWorldDialogProps) {
  const t = useT()
  const [name, setName] = useState(() => t.admin.duplicateWorld.defaultName.replace('{name}', world.name))
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || isDuplicating) return
    setIsDuplicating(true)
    setError(null)
    try {
      const response = await fetch(`/api/worlds/${world.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      onDuplicated()
      onClose()
    } catch {
      setError(t.admin.duplicateWorld.error)
    } finally {
      setIsDuplicating(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-md"
    >
      <motion.form
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
        className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-white/10 bg-abyss p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-bright/15 text-gold-bright">
              <FiCopy className="h-5 w-5" />
            </span>
            <h3 className="font-display text-h2 font-[300] text-white/95">{t.admin.duplicateWorld.title}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-white/50 transition hover:text-white">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <p className="font-sans text-caption text-mist">
          {t.admin.duplicateWorld.description.replace('{name}', world.name)}
        </p>

        <label className="flex flex-col gap-2">
          <span className="font-sans text-caption font-[700] text-white/70">{t.admin.duplicateWorld.nameLabel}</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onFocus={(event) => event.target.select()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose()
            }}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 font-sans text-body text-white/90 outline-none transition focus:border-gold-bright"
          />
        </label>

        {error && <p className="font-sans text-caption text-[#e0798f]">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 px-5 py-3 font-sans text-body text-white/70 transition hover:border-white/30"
          >
            {t.admin.duplicateWorld.cancel}
          </button>
          <button
            type="submit"
            disabled={isDuplicating || !name.trim()}
            className="rounded-xl bg-gradient-to-r from-gold to-gold-bright px-5 py-3 font-sans text-body font-[700] text-abyss transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDuplicating ? t.admin.duplicateWorld.duplicating : t.admin.duplicateWorld.confirm}
          </button>
        </div>
      </motion.form>
    </motion.div>
  )
}

export default function DuplicateWorldModal({ world, onClose, onDuplicated }: DuplicateWorldModalProps) {
  return (
    <AnimatePresence>
      {world && <DuplicateWorldDialog key={world.id} world={world} onClose={onClose} onDuplicated={onDuplicated} />}
    </AnimatePresence>
  )
}

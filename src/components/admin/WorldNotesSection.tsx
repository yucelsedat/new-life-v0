import { useMemo, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FiArrowDown, FiArrowUp, FiCheck, FiEdit3, FiPlus, FiTrash2 } from 'react-icons/fi'
import { useT } from '../../i18n'
import { useWorldNotes } from '../../hooks/useWorldNotes'
import type { WorldNote } from '../../types/world'
import { formatRelativeDate } from '../../utils/helpers'
import DeleteNoteModal from './DeleteNoteModal'

interface WorldNotesSectionProps {
  worldId: string
}

interface NoteRowProps {
  note: WorldNote
  isFirst: boolean
  isLast: boolean
  onToggleDone: () => void
  onSave: (patch: { title: string; body: string }) => Promise<boolean>
  onMove: (direction: -1 | 1) => void
  onRequestDelete: () => void
}

function NoteRow({ note, isFirst, isLast, onToggleDone, onSave, onMove, onRequestDelete }: NoteRowProps) {
  const t = useT()
  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(note.title)
  const [draftBody, setDraftBody] = useState(note.body)
  const [isSaving, setIsSaving] = useState(false)

  function startEditing() {
    setDraftTitle(note.title)
    setDraftBody(note.body)
    setIsEditing(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!draftTitle.trim()) return
    setIsSaving(true)
    const saved = await onSave({ title: draftTitle, body: draftBody })
    setIsSaving(false)
    if (saved) setIsEditing(false)
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`rounded-2xl border bg-black/30 p-4 backdrop-blur-xl transition ${
        note.done ? 'border-white/[0.06]' : 'border-white/10 hover:border-white/20'
      }`}
    >
      {isEditing ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            aria-label={t.admin.notes.titleLabel}
            className="rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 font-sans text-body text-white/90 outline-none transition focus:border-gold-bright"
          />
          <textarea
            value={draftBody}
            onChange={(event) => setDraftBody(event.target.value)}
            rows={3}
            aria-label={t.admin.notes.bodyLabel}
            className="scrollbar-none resize-y rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 font-sans text-body text-white/90 outline-none transition focus:border-gold-bright"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-xl border border-white/15 px-4 py-2 font-sans text-caption text-white/70 transition hover:border-white/30"
            >
              {t.admin.notes.cancelButton}
            </button>
            <button
              type="submit"
              disabled={isSaving || !draftTitle.trim()}
              className="rounded-xl bg-gradient-to-r from-gold to-gold-bright px-4 py-2 font-sans text-caption font-[700] text-abyss transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? t.admin.notes.saving : t.admin.notes.saveButton}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onToggleDone}
            aria-pressed={note.done}
            title={note.done ? t.admin.notes.markOpen : t.admin.notes.markDone}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
              note.done
                ? 'border-gold-bright bg-gold-bright text-abyss'
                : 'border-white/30 text-transparent hover:border-gold-bright'
            }`}
          >
            <FiCheck className="h-3.5 w-3.5" />
          </button>

          <div className="min-w-0 flex-1">
            <p
              className={`font-sans text-body font-[700] ${
                note.done ? 'text-white/40 line-through' : 'text-white/90'
              }`}
            >
              {note.title}
            </p>
            {note.body && (
              <p className={`mt-1 whitespace-pre-wrap font-sans text-caption ${note.done ? 'text-mist/50' : 'text-mist'}`}>
                {note.body}
              </p>
            )}
            <p className="mt-2 font-mono text-micro text-mist/70">
              {t.admin.notes.updatedAt} · {formatRelativeDate(note.updatedAt)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onMove(-1)}
              disabled={isFirst}
              title={t.admin.notes.moveUp}
              aria-label={t.admin.notes.moveUp}
              className="rounded-lg p-2 text-white/50 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
            >
              <FiArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={isLast}
              title={t.admin.notes.moveDown}
              aria-label={t.admin.notes.moveDown}
              className="rounded-lg p-2 text-white/50 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
            >
              <FiArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={startEditing}
              title={t.admin.notes.editButton}
              aria-label={t.admin.notes.editButton}
              className="rounded-lg p-2 text-white/50 transition hover:text-gold-bright"
            >
              <FiEdit3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onRequestDelete}
              title={t.admin.notes.deleteButton}
              aria-label={t.admin.notes.deleteButton}
              className="rounded-lg p-2 text-white/50 transition hover:text-[#e0798f]"
            >
              <FiTrash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </motion.li>
  )
}

export default function WorldNotesSection({ worldId }: WorldNotesSectionProps) {
  const t = useT()
  const { notes, error, createNote, updateNote, deleteNote, moveNote } = useWorldNotes(worldId)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<WorldNote | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const { open, done } = useMemo(
    () => ({
      open: notes.filter((note) => !note.done),
      done: notes.filter((note) => note.done),
    }),
    [notes],
  )

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!newTitle.trim()) return
    setIsCreating(true)
    const created = await createNote({ title: newTitle, body: newBody })
    setIsCreating(false)
    if (created) {
      setNewTitle('')
      setNewBody('')
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    setIsDeleting(true)
    const deleted = await deleteNote(pendingDelete.id)
    setIsDeleting(false)
    if (deleted) setPendingDelete(null)
  }

  const errorMessage =
    error === 'load'
      ? t.admin.notes.loadError
      : error === 'delete'
        ? t.admin.notes.deleteError
        : error === 'save'
          ? t.admin.notes.saveError
          : null

  function renderGroup(group: WorldNote[], heading: string) {
    if (group.length === 0) return null
    return (
      <div>
        <h3 className="mb-3 font-sans text-caption font-[700] uppercase tracking-[0.2em] text-mist">{heading}</h3>
        <ul className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {group.map((note, index) => (
              <NoteRow
                key={note.id}
                note={note}
                isFirst={index === 0}
                isLast={index === group.length - 1}
                onToggleDone={() => updateNote(note.id, { done: !note.done })}
                onSave={(patch) => updateNote(note.id, patch)}
                onMove={(direction) => moveNote(note.id, direction)}
                onRequestDelete={() => setPendingDelete(note)}
              />
            ))}
          </AnimatePresence>
        </ul>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-h2 font-[300] text-white/95">{t.admin.notes.title}</h2>
          <p className="font-sans text-caption text-mist">{t.admin.notes.subtitle}</p>
        </div>
        {notes.length > 0 && (
          <span className="font-mono text-caption text-gold-bright">
            {t.admin.notes.counter.replace('{done}', String(done.length)).replace('{total}', String(notes.length))}
          </span>
        )}
      </div>

      <form
        onSubmit={handleCreate}
        className="mb-8 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-xl"
      >
        <label className="flex flex-col gap-2">
          <span className="font-sans text-caption font-[700] text-white/70">{t.admin.notes.titleLabel}</span>
          <input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder={t.admin.notes.titlePlaceholder}
            className="rounded-xl border border-white/15 bg-black/40 px-4 py-3 font-sans text-body text-white/90 outline-none transition placeholder:text-mist/50 focus:border-gold-bright"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="font-sans text-caption font-[700] text-white/70">{t.admin.notes.bodyLabel}</span>
          <textarea
            value={newBody}
            onChange={(event) => setNewBody(event.target.value)}
            rows={3}
            placeholder={t.admin.notes.bodyPlaceholder}
            className="scrollbar-none resize-y rounded-xl border border-white/15 bg-black/40 px-4 py-3 font-sans text-body text-white/90 outline-none transition placeholder:text-mist/50 focus:border-gold-bright"
          />
        </label>

        <button
          type="submit"
          disabled={isCreating || !newTitle.trim()}
          className="flex items-center justify-center gap-2 self-start rounded-xl bg-gradient-to-r from-gold to-gold-bright px-5 py-3 font-sans text-body font-[700] text-abyss transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FiPlus className="h-4 w-4" />
          {isCreating ? t.admin.notes.adding : t.admin.notes.addButton}
        </button>
      </form>

      {errorMessage && <p className="mb-4 font-sans text-caption text-[#e0798f]">{errorMessage}</p>}

      {notes.length === 0 ? (
        <p className="font-sans text-caption text-mist">{t.admin.notes.empty}</p>
      ) : (
        <div className="flex flex-col gap-8">
          {renderGroup(open, t.admin.notes.openHeading)}
          {renderGroup(done, t.admin.notes.doneHeading)}
        </div>
      )}

      <DeleteNoteModal
        noteTitle={pendingDelete?.title ?? null}
        isDeleting={isDeleting}
        error={error === 'delete' ? t.admin.notes.deleteError : null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

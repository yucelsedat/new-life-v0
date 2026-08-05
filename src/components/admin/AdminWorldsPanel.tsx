import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { FiCheck, FiEdit2, FiEdit3, FiImage, FiTrash2, FiX } from 'react-icons/fi'
import type { SceneId, World } from '../../types/world'
import { useWorlds } from '../../hooks/useWorlds'
import { useT } from '../../i18n'
import { SCENE_IDS, SCENE_PALETTES } from '../../utils/constants'
import { formatPlayTime, formatProgress, formatRelativeDate } from '../../utils/helpers'
import DeleteWorldModal from './DeleteWorldModal'

async function createWorld(name: string, sceneId: SceneId, sceneLabel: string): Promise<World> {
  const response = await fetch('/api/worlds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, sceneId, sceneLabel }),
  })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return (await response.json()) as World
}

const ACTION_BUTTON =
  'flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 text-white/70 transition hover:border-gold-bright hover:text-gold-bright'
const DANGER_BUTTON =
  'flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 text-white/70 transition hover:border-[#e0798f] hover:text-[#e0798f]'

async function updateWorld(id: string, name: string, sceneId: SceneId, sceneLabel: string): Promise<void> {
  const response = await fetch(`/api/worlds/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, sceneId, sceneLabel }),
  })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
}

export default function AdminWorldsPanel() {
  const t = useT()
  const { worlds, isLoading, isFallback, refetch } = useWorlds()

  const [name, setName] = useState('')
  const [sceneId, setSceneId] = useState<SceneId>('salon')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftSceneId, setDraftSceneId] = useState<SceneId>('salon')
  const [isSavingRow, setIsSavingRow] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)
  const [deletingWorldId, setDeletingWorldId] = useState<string | null>(null)

  function startEditing(world: World) {
    setEditingId(world.id)
    setDraftName(world.name)
    setDraftSceneId(world.sceneId)
    setRowError(null)
  }

  function cancelEditing() {
    setEditingId(null)
    setRowError(null)
  }

  async function saveEditing() {
    if (!editingId || !draftName.trim()) return
    setIsSavingRow(true)
    setRowError(null)
    try {
      await updateWorld(editingId, draftName.trim(), draftSceneId, t.scenes[draftSceneId])
      setEditingId(null)
      await refetch()
    } catch {
      setRowError(t.admin.worlds.updateError)
    } finally {
      setIsSavingRow(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    setError(null)
    try {
      await createWorld(name.trim(), sceneId, t.scenes[sceneId])
      setName('')
      await refetch()
    } catch {
      setError(t.admin.worlds.loadError)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[360px_1fr]">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 self-start rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur-xl"
      >
        <h2 className="font-display text-h2 font-[300] text-white/95">{t.admin.worlds.createTitle}</h2>

        <label className="flex flex-col gap-2">
          <span className="font-sans text-caption font-[700] text-white/70">{t.admin.worlds.nameLabel}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t.admin.worlds.namePlaceholder}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 font-sans text-body text-white/90 outline-none transition focus:border-gold-bright"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="font-sans text-caption font-[700] text-white/70">{t.admin.worlds.sceneLabel}</span>
          <div className="grid grid-cols-3 gap-2">
            {SCENE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSceneId(id)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition ${
                  sceneId === id ? 'border-gold-bright bg-white/10' : 'border-white/10 hover:border-white/25'
                }`}
              >
                <span
                  className="h-4 w-4 rounded-full"
                  style={{ background: SCENE_PALETTES[id].accent, boxShadow: `0 0 8px ${SCENE_PALETTES[id].glow}` }}
                />
                <span className="font-sans text-micro text-white/75">{t.scenes[id]}</span>
              </button>
            ))}
          </div>
        </label>

        {error && <p className="font-sans text-caption text-[#e0798f]">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="mt-2 rounded-xl bg-gradient-to-r from-gold to-gold-bright px-5 py-3 font-sans text-body font-[700] text-abyss transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting ? t.admin.worlds.submitting : t.admin.worlds.submit}
        </button>
      </form>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur-xl">
        <h2 className="mb-5 font-display text-h2 font-[300] text-white/95">{t.admin.worlds.existingTitle}</h2>

        {isFallback && !isLoading && (
          <p className="mb-4 font-mono text-micro text-[#e0a34a]">{t.admin.worlds.loadError}</p>
        )}

        {worlds.length === 0 ? (
          <p className="font-sans text-caption text-mist">{t.admin.worlds.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-white/10 font-mono text-micro uppercase tracking-wide text-white/50">
                  <th className="py-2 pr-4">{t.admin.worlds.slot}</th>
                  <th className="py-2 pr-4">{t.admin.worlds.nameLabel}</th>
                  <th className="py-2 pr-4">{t.admin.worlds.sceneLabel}</th>
                  <th className="py-2 pr-4">{t.admin.worlds.progress}</th>
                  <th className="py-2 pr-4">{t.admin.worlds.lastPlayed}</th>
                  <th className="py-2 pr-4" />
                </tr>
              </thead>
              <tbody>
                {worlds.map((world) => {
                  const isEditing = editingId === world.id
                  return (
                  <tr key={world.id} className="border-b border-white/5">
                    <td className="py-3 pr-4 font-mono text-micro text-white/50">#{world.slot}</td>
                    <td className="py-3 pr-4 font-sans text-body text-white/90 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={draftName}
                          onChange={(event) => setDraftName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') saveEditing()
                            if (event.key === 'Escape') cancelEditing()
                          }}
                          className="w-full min-w-[10rem] rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 font-sans text-body text-white/90 outline-none transition focus:border-gold-bright"
                        />
                      ) : (
                        world.name
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {isEditing ? (
                        <div className="flex flex-wrap gap-1">
                          {SCENE_IDS.map((id) => (
                            <button
                              key={id}
                              type="button"
                              title={t.scenes[id]}
                              aria-label={t.scenes[id]}
                              onClick={() => setDraftSceneId(id)}
                              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                                draftSceneId === id ? 'border-gold-bright bg-white/10' : 'border-white/10 hover:border-white/25'
                              }`}
                            >
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ background: SCENE_PALETTES[id].accent }}
                              />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="flex items-center gap-2 font-sans text-caption text-white/70">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: SCENE_PALETTES[world.sceneId].accent }}
                          />
                          {world.sceneLabel}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-[3px] w-16 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-gold to-gold-bright"
                            style={{ width: `${world.progress * 100}%` }}
                          />
                        </div>
                        <span className="font-mono text-micro text-gold-bright">{formatProgress(world.progress)}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-sans text-caption text-mist">
                      {formatRelativeDate(world.lastPlayedAt)} · {formatPlayTime(world.playTimeMinutes)}
                    </td>
                    <td className="py-3 pr-4">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={saveEditing}
                            disabled={isSavingRow || !draftName.trim()}
                            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-gold to-gold-bright px-3 py-1.5 font-sans text-micro font-[700] text-abyss transition disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <FiCheck className="h-3 w-3" />
                            {isSavingRow ? t.admin.worlds.saving : t.admin.worlds.saveButton}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 font-sans text-micro font-[700] text-white/70 transition hover:border-white/30"
                          >
                            <FiX className="h-3 w-3" />
                            {t.admin.worlds.cancelButton}
                          </button>
                          {rowError && <span className="font-sans text-micro text-[#e0798f]">{rowError}</span>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEditing(world)}
                            title={t.admin.worlds.renameButton}
                            aria-label={t.admin.worlds.renameButton}
                            className={ACTION_BUTTON}
                          >
                            <FiEdit2 className="h-3.5 w-3.5" />
                          </button>
                          <Link
                            to={`/admin/worlds/${world.id}/assets`}
                            title={t.admin.assets.button}
                            aria-label={t.admin.assets.button}
                            className={ACTION_BUTTON}
                          >
                            <FiImage className="h-3.5 w-3.5" />
                          </Link>
                          <Link
                            to={`/admin/worlds/${world.id}`}
                            title={t.admin.worlds.editButton}
                            aria-label={t.admin.worlds.editButton}
                            className={ACTION_BUTTON}
                          >
                            <FiEdit3 className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeletingWorldId(world.id)}
                            title={t.admin.worlds.deleteButton}
                            aria-label={t.admin.worlds.deleteButton}
                            className={DANGER_BUTTON}
                          >
                            <FiTrash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DeleteWorldModal
        worldId={deletingWorldId}
        onClose={() => setDeletingWorldId(null)}
        onDeleted={refetch}
      />
    </div>
  )
}

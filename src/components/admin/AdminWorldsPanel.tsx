import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { FiEdit3, FiImage } from 'react-icons/fi'
import type { SceneId, World } from '../../types/world'
import { useWorlds } from '../../hooks/useWorlds'
import { useT } from '../../i18n'
import { SCENE_IDS, SCENE_PALETTES } from '../../utils/constants'
import { formatPlayTime, formatProgress, formatRelativeDate } from '../../utils/helpers'

async function createWorld(name: string, sceneId: SceneId, sceneLabel: string): Promise<World> {
  const response = await fetch('/api/worlds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, sceneId, sceneLabel }),
  })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return (await response.json()) as World
}

export default function AdminWorldsPanel() {
  const t = useT()
  const { worlds, isLoading, isFallback, refetch } = useWorlds()

  const [name, setName] = useState('')
  const [sceneId, setSceneId] = useState<SceneId>('salon')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
                {worlds.map((world) => (
                  <tr key={world.id} className="border-b border-white/5">
                    <td className="py-3 pr-4 font-mono text-micro text-white/50">#{world.slot}</td>
                    <td className="py-3 pr-4 font-sans text-body text-white/90">{world.name}</td>
                    <td className="py-3 pr-4">
                      <span className="flex items-center gap-2 font-sans text-caption text-white/70">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: SCENE_PALETTES[world.sceneId].accent }}
                        />
                        {world.sceneLabel}
                      </span>
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
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/admin/worlds/${world.id}/assets`}
                          className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 font-sans text-micro font-[700] text-white/70 transition hover:border-gold-bright hover:text-gold-bright"
                        >
                          <FiImage className="h-3 w-3" />
                          {t.admin.assets.button}
                        </Link>
                        <Link
                          to={`/admin/worlds/${world.id}`}
                          className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 font-sans text-micro font-[700] text-white/70 transition hover:border-gold-bright hover:text-gold-bright"
                        >
                          <FiEdit3 className="h-3 w-3" />
                          {t.admin.worlds.editButton}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

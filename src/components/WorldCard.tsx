import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { FiPlay } from 'react-icons/fi'
import type { World } from '../types/world'
import { useT } from '../i18n'
import { fadeUp } from '../utils/animations'
import { formatProgress, formatRelativeDate } from '../utils/helpers'
import { getProceduralSceneDataUrl } from '../utils/proceduralScenes'

interface WorldCardProps {
  world: World
  onEnter: (id: string) => void
}

export default function WorldCard({ world, onEnter }: WorldCardProps) {
  const t = useT()
  const fallbackImage = useMemo(() => getProceduralSceneDataUrl(world.sceneId), [world.sceneId])
  const imageSrc = world.sceneImageUrl ?? fallbackImage

  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-lg"
    >
      <img
        src={imageSrc}
        alt={world.name}
        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5">
        <div>
          <h3 className="font-display text-h2 font-[300] text-white/95">{world.name}</h3>
          <p className="font-sans text-caption text-mist">
            {t.world.lastPlayed}: {formatRelativeDate(world.lastPlayedAt)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold to-gold-bright"
              style={{ width: `${world.progress * 100}%` }}
            />
          </div>
          <span className="font-mono text-micro text-gold-bright">{formatProgress(world.progress)}</span>
        </div>

        <button
          type="button"
          onClick={() => onEnter(world.id)}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-bright px-5 py-3 font-sans text-body font-[700] text-abyss transition hover:brightness-105"
        >
          <FiPlay className="h-4 w-4" />
          {t.world.enter}
        </button>
      </div>
    </motion.div>
  )
}

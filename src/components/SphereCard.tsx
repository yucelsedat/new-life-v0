import { Html } from '@react-three/drei'
import { AnimatePresence, motion } from 'framer-motion'
import type { World } from '../types/world'
import { cardInfoFade } from '../utils/animations'
import { formatPlayTime, formatProgress, formatRelativeDate } from '../utils/helpers'
import { useT } from '../i18n'

interface SphereCardProps {
  world: World
  isHero: boolean
  expanded: boolean
}

const LOCAL_UNIT_RADIUS = 1

export default function SphereCard({ world, isHero, expanded }: SphereCardProps) {
  const t = useT()

  return (
    <Html
      center
      position={[0, -LOCAL_UNIT_RADIUS * 1.55, 0]}
      style={{ pointerEvents: 'none' }}
      zIndexRange={[10, 0]}
    >
      <div className={`flex flex-col items-center text-center ${isHero ? 'w-56' : 'w-36'}`}>
        <span className={`font-display font-[300] text-white/95 ${isHero ? 'text-h2' : 'text-body'}`}>{world.name}</span>

        <AnimatePresence>
          {expanded && (
            <motion.div
              key="details"
              variants={cardInfoFade}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="mt-1.5 flex flex-col items-center gap-1"
            >
              <span className="font-sans text-caption text-mist">
                {t.world.lastPlayed}: {formatRelativeDate(world.lastPlayedAt)}
              </span>
              <span className="font-mono text-micro text-ice">{formatPlayTime(world.playTimeMinutes)}</span>

              <div className="mt-1 h-[2px] w-24 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold to-gold-bright"
                  style={{ width: `${world.progress * 100}%` }}
                />
              </div>
              <span className="font-mono text-micro text-gold-bright">{formatProgress(world.progress)}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Html>
  )
}

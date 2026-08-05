import { motion } from 'framer-motion'
import { FiBell } from 'react-icons/fi'
import { GiCrown } from 'react-icons/gi'
import type { Profile } from '../types/world'
import { slideFromRight } from '../utils/animations'
import { useT } from '../i18n'

interface ProfileCardProps {
  profile: Profile
}

function xpIntoLevel(xp: number): number {
  return xp % 500
}

export default function ProfileCard({ profile }: ProfileCardProps) {
  const t = useT()
  const progress = xpIntoLevel(profile.xp) / 500

  return (
    <motion.div
      variants={slideFromRight}
      className="pointer-events-auto flex shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-2.5 py-2 backdrop-blur-xl sm:gap-3 sm:px-4 sm:py-2.5"
    >
      <div className="relative">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full text-caption font-[700] text-abyss sm:h-10 sm:w-10"
          style={{
            background: `conic-gradient(from 140deg, #e8c766, #c9a227, #8fb4c9, #e8c766)`,
          }}
        >
          {profile.displayName.slice(0, 2).toUpperCase()}
        </div>
        {profile.isPremium && (
          <GiCrown className="absolute -top-1.5 -right-1.5 h-4 w-4 text-gold-bright drop-shadow-[0_0_4px_rgba(232,199,102,0.8)]" />
        )}
      </div>

      <div className="hidden flex-col gap-1 sm:flex">
        <div className="flex items-baseline gap-2">
          <span className="font-sans text-body font-[700] text-white/90">{profile.displayName}</span>
          <span className="font-mono text-micro text-gold-bright">
            {t.profile.level} {profile.level}
          </span>
        </div>
        <div className="h-[3px] w-28 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-bright" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <button
        type="button"
        aria-label={t.profile.notifications}
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white sm:ml-2"
      >
        <FiBell className="h-4 w-4" />
        {profile.unreadNotifications > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold-bright font-mono text-[9px] font-[700] text-abyss">
            {profile.unreadNotifications}
          </span>
        )}
      </button>
    </motion.div>
  )
}

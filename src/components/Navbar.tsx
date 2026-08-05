import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { FiPlay, FiPlus, FiFolder, FiSettings, FiMusic, FiHelpCircle, FiLogOut } from 'react-icons/fi'
import { GiChefToque } from 'react-icons/gi'
import type { IconType } from 'react-icons'
import type { Profile } from '../types/world'
import Logo from './Logo'
import ProfileCard from './ProfileCard'
import { fadeUp } from '../utils/animations'
import { useT } from '../i18n'

interface NavbarProps {
  profile: Profile
}

interface NavItem {
  icon: IconType
  label: string
}

export default function Navbar({ profile }: NavbarProps) {
  const t = useT()

  const items: NavItem[] = [
    { icon: FiPlay, label: t.menu.continue },
    { icon: FiPlus, label: t.menu.newWorld },
    { icon: FiFolder, label: t.menu.saves },
    { icon: FiSettings, label: t.menu.settings },
    { icon: FiMusic, label: t.menu.music },
    { icon: FiHelpCircle, label: t.menu.help },
    { icon: FiLogOut, label: t.menu.exit },
  ]

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5 md:px-10">
      <div className="min-w-0 shrink">
        <Logo />
      </div>

      <motion.nav
        variants={fadeUp}
        className="pointer-events-auto flex shrink-0 items-center gap-1 rounded-2xl border border-white/10 bg-black/40 p-1.5 backdrop-blur-xl"
      >
        <div className="hidden items-center gap-1 lg:flex">
          {items.map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              className="group flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-300 hover:bg-white/10"
            >
              <Icon className="h-4 w-4 text-white/70 transition-colors duration-300 group-hover:text-gold-bright" />
            </button>
          ))}
          <span className="mx-1.5 h-6 w-px bg-white/10" />
        </div>

        <Link
          to="/admin"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-bright px-4 py-2 font-sans text-caption font-[700] text-abyss transition hover:brightness-105"
        >
          <GiChefToque className="h-4 w-4" />
          {t.menu.kitchen}
        </Link>
      </motion.nav>

      <ProfileCard profile={profile} />
    </header>
  )
}

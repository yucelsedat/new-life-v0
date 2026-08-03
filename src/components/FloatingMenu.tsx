import { motion } from 'framer-motion'
import { FiPlay, FiPlus, FiFolder, FiSettings, FiMusic, FiHelpCircle, FiLogOut } from 'react-icons/fi'
import type { IconType } from 'react-icons'
import { slideFromLeft } from '../utils/animations'
import { useT } from '../i18n'

interface MenuItem {
  icon: IconType
  label: string
}

export default function FloatingMenu() {
  const t = useT()

  const items: MenuItem[] = [
    { icon: FiPlay, label: t.menu.continue },
    { icon: FiPlus, label: t.menu.newWorld },
    { icon: FiFolder, label: t.menu.saves },
    { icon: FiSettings, label: t.menu.settings },
    { icon: FiMusic, label: t.menu.music },
    { icon: FiHelpCircle, label: t.menu.help },
    { icon: FiLogOut, label: t.menu.exit },
  ]

  return (
    <motion.nav
      variants={slideFromLeft}
      className="pointer-events-auto flex flex-row gap-1 rounded-2xl border border-white/10 bg-black/40 p-2 backdrop-blur-xl sm:flex-col"
    >
      {items.map(({ icon: Icon, label }) => (
        <button
          key={label}
          type="button"
          className="group relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors duration-300 hover:bg-white/10 sm:px-3"
        >
          <Icon className="h-4 w-4 shrink-0 text-white/70 transition-colors duration-300 group-hover:text-gold-bright" />
          <span className="hidden max-w-0 overflow-hidden whitespace-nowrap font-sans text-caption font-[500] text-white/85 opacity-0 transition-all duration-300 group-hover:max-w-[8rem] group-hover:opacity-100 sm:inline-block">
            {label}
          </span>
        </button>
      ))}
    </motion.nav>
  )
}

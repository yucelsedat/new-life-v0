import { motion } from 'framer-motion'
import { logoReveal } from '../utils/animations'
import { useT } from '../i18n'

export default function Logo() {
  const t = useT()

  return (
    <motion.div variants={logoReveal} className="pointer-events-none flex flex-col items-start text-left">
      <h1 className="font-display text-[1.35rem] md:text-[1.75rem] font-[200] leading-none tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#f5efe0] via-[#e8c766] to-[#c9a227] whitespace-nowrap">
        {t.brand.title}
      </h1>
      <p className="mt-1 hidden font-display text-[0.6rem] font-[300] italic uppercase tracking-[0.14em] text-[#c9c2a8] whitespace-nowrap md:block">
        {t.brand.tagline}
      </p>
    </motion.div>
  )
}

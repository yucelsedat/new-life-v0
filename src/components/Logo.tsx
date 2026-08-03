import { motion } from 'framer-motion'
import { logoReveal } from '../utils/animations'
import { useT } from '../i18n'

export default function Logo() {
  const t = useT()

  return (
    <motion.div variants={logoReveal} className="pointer-events-none flex flex-col items-center text-center">
      <h1 className="font-display text-logo font-[200] tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#f5efe0] via-[#e8c766] to-[#c9a227]">
        {t.brand.title}
      </h1>
      <p className="mt-2 font-display text-tagline font-[300] italic text-[#c9c2a8] uppercase">
        {t.brand.tagline}
      </p>
    </motion.div>
  )
}

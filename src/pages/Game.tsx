import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function Game() {
  const navigate = useNavigate()

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-void">
      <motion.span
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="font-display text-h1 font-[200] text-white/90"
      >
        Hikayen Devam Ediyor…
      </motion.span>
      <button
        type="button"
        onClick={() => navigate('/')}
        className="rounded-full border border-white/15 px-6 py-2 font-sans text-caption text-white/70 transition hover:border-gold-bright hover:text-gold-bright"
      >
        Ana Menüye Dön
      </button>
    </div>
  )
}

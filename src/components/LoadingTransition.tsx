import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { CAMERA } from '../utils/constants'

interface LoadingTransitionProps {
  active: boolean
  onComplete: () => void
}

export default function LoadingTransition({ active, onComplete }: LoadingTransitionProps) {
  const t = useT()
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!active) {
      setProgress(0)
      return
    }

    const start = performance.now()
    let rafId: number

    function tick(now: number) {
      const elapsed = now - start
      const next = Math.min(1, elapsed / (CAMERA.dollyDurationMs + 900))
      setProgress(next)
      if (next < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        onComplete()
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [active, onComplete])

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center bg-void"
        >
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: [0, 0.9, 0] }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
            className="absolute h-40 w-40 rounded-full bg-gold-bright blur-3xl"
          />

          <span className="font-display text-h1 font-[200] text-white/95">{t.loading.title}</span>
          <span className="mt-2 font-sans text-caption text-mist">{t.loading.subtitle}</span>

          <div className="mt-8 h-[2px] w-64 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-gold to-gold-bright"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

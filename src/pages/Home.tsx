import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import WorldCard from '../components/WorldCard'
import FloatingMenu from '../components/FloatingMenu'
import TopBar from '../components/TopBar'
import StatusBar from '../components/StatusBar'
import LoadingTransition from '../components/LoadingTransition'
import { useWorlds } from '../hooks/useWorlds'
import { useProfile } from '../hooks/useProfile'
import { useSystemStatus } from '../hooks/useSystemStatus'
import { useFpsMeter } from '../hooks/useFpsMeter'
import { staggerContainer } from '../utils/animations'

export default function Home() {
  const navigate = useNavigate()
  const { worlds } = useWorlds()
  const profile = useProfile()
  const status = useSystemStatus()
  const fps = useFpsMeter()

  const [isTransitioning, setIsTransitioning] = useState(false)
  const [enteringWorldId, setEnteringWorldId] = useState<string | null>(null)

  const handleEnter = useCallback((worldId: string) => {
    setEnteringWorldId(worldId)
    setIsTransitioning(true)
  }, [])

  const handleTransitionComplete = useCallback(() => {
    if (enteringWorldId) navigate(`/game/${enteringWorldId}`)
  }, [navigate, enteringWorldId])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-void">
      <div className="h-full overflow-y-auto px-6 pt-24 pb-28 sm:pl-32 sm:pr-10 sm:pt-36 lg:px-32">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="mx-auto grid max-w-7xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {worlds.map((world) => (
            <WorldCard key={world.id} world={world} onEnter={handleEnter} />
          ))}
        </motion.div>
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="pointer-events-none absolute inset-0 z-10"
      >
        <TopBar profile={profile} />

        <div className="pointer-events-none fixed inset-x-4 bottom-4 z-20 flex justify-center sm:inset-x-auto sm:bottom-auto sm:left-6 sm:top-1/2 sm:-translate-y-1/2 sm:justify-start">
          <FloatingMenu />
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 hidden justify-center sm:flex">
          <StatusBar fps={fps} status={status} />
        </div>
      </motion.div>

      <LoadingTransition active={isTransitioning} onComplete={handleTransitionComplete} />
    </div>
  )
}

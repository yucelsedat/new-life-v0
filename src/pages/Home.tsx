import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Scene from '../three/Scene'
import FloatingMenu from '../components/FloatingMenu'
import TopBar from '../components/TopBar'
import StatusBar from '../components/StatusBar'
import LoadingTransition from '../components/LoadingTransition'
import { useWorlds } from '../hooks/useWorlds'
import { useProfile } from '../hooks/useProfile'
import { useSystemStatus } from '../hooks/useSystemStatus'
import { useFpsMeter } from '../hooks/useFpsMeter'
import { useResponsiveLayout } from '../hooks/useResponsiveLayout'
import { useMouseParallax } from '../hooks/useMouseParallax'
import { useSphereCarousel } from '../hooks/useSphereCarousel'
import { createCameraFocus, type CameraFocusState } from '../three/cameraFocus'
import { staggerContainer } from '../utils/animations'

export default function Home() {
  const navigate = useNavigate()
  const { worlds } = useWorlds()
  const profile = useProfile()
  const status = useSystemStatus()
  const fps = useFpsMeter()
  const layout = useResponsiveLayout()
  const parallax = useMouseParallax()
  const carousel = useSphereCarousel(worlds.length)

  const cameraFocusRef = useRef<CameraFocusState | null>(null)
  if (!cameraFocusRef.current) cameraFocusRef.current = createCameraFocus()

  const [hoveredWorldId, setHoveredWorldId] = useState<string | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    if (layout.breakpoint !== 'mobile' || worlds.length === 0) return
    setHoveredWorldId(worlds[carousel.activeIndex]?.id ?? null)
  }, [carousel.activeIndex, layout.breakpoint, worlds])

  const handleSelectWorld = useCallback((_id: string, position: [number, number, number]) => {
    const focus = cameraFocusRef.current
    if (!focus) return
    focus.position.set(position[0], position[1], position[2])
    focus.dollying = true
    setIsTransitioning(true)
  }, [])

  const handleTransitionComplete = useCallback(() => {
    navigate('/game')
  }, [navigate])

  const isMobile = layout.breakpoint === 'mobile'

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-void">
      <div className="absolute inset-0" {...(isMobile ? carousel.bind : {})}>
        <Scene
          worlds={worlds}
          layout={layout}
          hoveredWorldId={hoveredWorldId}
          onHoverWorld={setHoveredWorldId}
          onSelectWorld={handleSelectWorld}
          parallax={parallax}
          cameraFocus={cameraFocusRef as RefObject<CameraFocusState>}
        />
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

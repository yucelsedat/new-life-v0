import { useEffect, useRef, useState } from 'react'

export function useFpsMeter(): number {
  const [fps, setFps] = useState(60)
  const frames = useRef(0)
  const lastSample = useRef(performance.now())

  useEffect(() => {
    let rafId: number

    function tick() {
      frames.current += 1
      const now = performance.now()
      const elapsed = now - lastSample.current
      if (elapsed >= 500) {
        setFps(Math.round((frames.current * 1000) / elapsed))
        frames.current = 0
        lastSample.current = now
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return fps
}

import { useEffect, useState } from 'react'
import { WORLD_MINUTE_MS } from '../utils/worldClock'

/**
 * Minutes elapsed on the world clock since play began, one world-minute per real second.
 * It counts up rather than wrapping, so option activations stay in order across midnight.
 */
export function useWorldClock(running = true): number {
  const [elapsedMinutes, setElapsedMinutes] = useState(0)

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setElapsedMinutes((previous) => previous + 1), WORLD_MINUTE_MS)
    return () => clearInterval(timer)
  }, [running])

  return elapsedMinutes
}

import { useCallback, useEffect, useState } from 'react'
import { WORLD_START_MINUTE } from '../utils/worldClock'
import type { WorldOptionTime } from '../types/world'

export interface UseWorldOptionTimesResult {
  optionTimes: WorldOptionTime[]
  /** The minute an option index is set to, falling back to the world's opening time. */
  timeFor: (optionIndex: number) => number
  /** Resolves false when the write did not land, so the caller can say so on screen. */
  setOptionTime: (optionIndex: number, minuteOfDay: number) => Promise<boolean>
  error: string | null
}

const OPENING_ONLY: WorldOptionTime[] = [{ optionIndex: 0, minuteOfDay: WORLD_START_MINUTE }]

/**
 * The world's option schedule. An option index is a moment shared by every scene, so
 * this is fetched and written per world — never per scene.
 */
export function useWorldOptionTimes(worldId: string): UseWorldOptionTimesResult {
  const [optionTimes, setOptionTimes] = useState<WorldOptionTime[]>(OPENING_ONLY)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!worldId) return
    const controller = new AbortController()

    fetch(`/api/worlds/${worldId}/option-times`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('load-failed'))))
      .then((times: WorldOptionTime[]) => setOptionTimes(times.length > 0 ? times : OPENING_ONLY))
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        setError('load-failed')
      })

    return () => controller.abort()
  }, [worldId])

  const timeFor = useCallback(
    (optionIndex: number) =>
      optionTimes.find((time) => time.optionIndex === optionIndex)?.minuteOfDay ?? WORLD_START_MINUTE,
    [optionTimes],
  )

  const setOptionTime = useCallback(
    async (optionIndex: number, minuteOfDay: number): Promise<boolean> => {
      setError(null)
      try {
        const response = await fetch(`/api/worlds/${worldId}/option-times/${optionIndex}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ minuteOfDay }),
        })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        setOptionTimes((await response.json()) as WorldOptionTime[])
        return true
      } catch {
        setError('update-failed')
        return false
      }
    },
    [worldId],
  )

  return { optionTimes, timeFor, setOptionTime, error }
}

import { useCallback, useEffect, useState } from 'react'
import type { World } from '../types/world'
import { FALLBACK_WORLDS } from '../utils/fallbackData'

export interface UseWorldsResult {
  worlds: World[]
  isLoading: boolean
  isFallback: boolean
  refetch: () => Promise<void>
}

export function useWorlds(): UseWorldsResult {
  const [worlds, setWorlds] = useState<World[]>(FALLBACK_WORLDS)
  const [isLoading, setIsLoading] = useState(true)
  const [isFallback, setIsFallback] = useState(true)

  const fetchWorlds = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/worlds', { signal })
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      const data = (await response.json()) as World[]
      setWorlds(data)
      setIsFallback(false)
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      setWorlds(FALLBACK_WORLDS)
      setIsFallback(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchWorlds(controller.signal)
    return () => controller.abort()
  }, [fetchWorlds])

  const refetch = useCallback(() => fetchWorlds(), [fetchWorlds])

  return { worlds, isLoading, isFallback, refetch }
}

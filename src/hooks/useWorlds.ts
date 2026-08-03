import { useEffect, useState } from 'react'
import type { World } from '../types/world'
import { FALLBACK_WORLDS } from '../utils/fallbackData'

export interface UseWorldsResult {
  worlds: World[]
  isLoading: boolean
  isFallback: boolean
}

export function useWorlds(): UseWorldsResult {
  const [worlds, setWorlds] = useState<World[]>(FALLBACK_WORLDS)
  const [isLoading, setIsLoading] = useState(true)
  const [isFallback, setIsFallback] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const response = await fetch('/api/worlds', { signal: controller.signal })
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
    }

    load()
    return () => controller.abort()
  }, [])

  return { worlds, isLoading, isFallback }
}

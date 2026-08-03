import { useEffect, useState } from 'react'
import type { Profile } from '../types/world'
import { FALLBACK_PROFILE } from '../utils/fallbackData'

export function useProfile(): Profile {
  const [profile, setProfile] = useState<Profile>(FALLBACK_PROFILE)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const response = await fetch('/api/profile', { signal: controller.signal })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        const data = (await response.json()) as Profile
        setProfile(data)
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
        setProfile(FALLBACK_PROFILE)
      }
    }

    load()
    return () => controller.abort()
  }, [])

  return profile
}

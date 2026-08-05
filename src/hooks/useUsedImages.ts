import { useCallback, useEffect, useState } from 'react'

/**
 * Image URLs this world already consumes (scene backgrounds, options, story frames).
 * Editor pickers hide these so an image is never used twice.
 */
export function useUsedImages(worldId: string) {
  const [urls, setUrls] = useState<string[]>([])

  const refetch = useCallback(async () => {
    if (!worldId) return
    try {
      const response = await fetch(`/api/worlds/${worldId}/used-images`)
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      const data = (await response.json()) as { urls: string[] }
      setUrls(data.urls)
    } catch {
      setUrls([])
    }
  }, [worldId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { usedUrls: urls, refetchUsed: refetch }
}

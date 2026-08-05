import { useCallback, useEffect, useState } from 'react'
import type { GalleryImage, ImageKind } from '../types/world'

export interface GalleryScope {
  /** A world id, or 'global' for the shared library. Omit to fetch every image. */
  worldId?: string | 'global'
  kind?: ImageKind
}

export interface UseGalleryImagesResult {
  images: GalleryImage[]
  isLoading: boolean
  refetch: () => Promise<void>
}

function buildQuery({ worldId, kind }: GalleryScope): string {
  const params = new URLSearchParams()
  if (worldId) params.set('worldId', worldId)
  if (kind) params.set('kind', kind)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function useGalleryImages(scope: GalleryScope = {}): UseGalleryImagesResult {
  const { worldId, kind } = scope
  const [images, setImages] = useState<GalleryImage[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchImages = useCallback(async () => {
    try {
      const response = await fetch(`/api/gallery${buildQuery({ worldId, kind })}`)
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      const data = (await response.json()) as GalleryImage[]
      setImages(data)
    } catch {
      setImages([])
    } finally {
      setIsLoading(false)
    }
  }, [worldId, kind])

  useEffect(() => {
    fetchImages()
  }, [fetchImages])

  return { images, isLoading, refetch: fetchImages }
}

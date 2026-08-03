import { useCallback, useEffect, useState } from 'react'
import type { GalleryImage } from '../types/world'

export interface UseGalleryImagesResult {
  images: GalleryImage[]
  isLoading: boolean
  refetch: () => Promise<void>
}

export function useGalleryImages(): UseGalleryImagesResult {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchImages = useCallback(async () => {
    try {
      const response = await fetch('/api/gallery')
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      const data = (await response.json()) as GalleryImage[]
      setImages(data)
    } catch {
      setImages([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchImages()
  }, [fetchImages])

  return { images, isLoading, refetch: fetchImages }
}

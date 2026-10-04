import { useCallback, useState } from 'react'
import type { GalleryImage } from '../types/world'
import type { GalleryScope } from './useGalleryImages'

export interface UseImageUploadResult {
  /** Files the images under the scope. Resolves to what was created — nothing when it failed. */
  upload: (files: File[]) => Promise<GalleryImage[]>
  isUploading: boolean
  /** True once an upload has been refused, until the next attempt. */
  uploadFailed: boolean
}

/** Uploads images into one library: a world's scene or character assets, or the global ones. */
export function useImageUpload({ worldId, kind }: GalleryScope): UseImageUploadResult {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadFailed, setUploadFailed] = useState(false)

  const upload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return []

      const formData = new FormData()
      files.forEach((file) => formData.append('images', file))
      if (worldId) formData.append('worldId', worldId)
      if (kind) formData.append('kind', kind)

      setIsUploading(true)
      setUploadFailed(false)
      try {
        const response = await fetch('/api/gallery', { method: 'POST', body: formData })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        return (await response.json()) as GalleryImage[]
      } catch {
        setUploadFailed(true)
        return []
      } finally {
        setIsUploading(false)
      }
    },
    [worldId, kind],
  )

  return { upload, isUploading, uploadFailed }
}

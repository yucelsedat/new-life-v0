import { useRef, useState, type ChangeEvent } from 'react'
import { FiUploadCloud } from 'react-icons/fi'
import { useT } from '../../i18n'
import { useGalleryImages, type GalleryScope } from '../../hooks/useGalleryImages'
import type { GalleryImage } from '../../types/world'
import { formatFileSize, formatRelativeDate } from '../../utils/helpers'

interface ImageLibrarySectionProps {
  title: string
  subtitle: string
  emptyLabel: string
  /** Which images this section shows — and, on upload, which scope they are filed under. */
  scope: GalleryScope
}

function ImageCard({ image }: { image: GalleryImage }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl">
      <img src={image.url} alt={image.originalName} className="aspect-square w-full object-cover" />
      <div className="px-4 py-3">
        <span className="block truncate font-sans text-caption font-[700] text-white/85">{image.originalName}</span>
        <span className="font-mono text-micro text-mist">
          {formatFileSize(image.sizeBytes)} · {formatRelativeDate(image.uploadedAt)}
        </span>
      </div>
    </div>
  )
}

export default function ImageLibrarySection({ title, subtitle, emptyLabel, scope }: ImageLibrarySectionProps) {
  const t = useT()
  const { images, refetch } = useGalleryImages(scope)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!files || files.length === 0) return

    const formData = new FormData()
    Array.from(files).forEach((file) => formData.append('images', file))
    if (scope.worldId) formData.append('worldId', scope.worldId)
    if (scope.kind) formData.append('kind', scope.kind)

    setIsUploading(true)
    setError(null)
    try {
      const response = await fetch('/api/gallery', { method: 'POST', body: formData })
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      await refetch()
    } catch {
      setError(t.admin.gallery.uploadError)
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-h2 font-[300] text-white/95">{title}</h2>
          <p className="font-sans text-caption text-mist">{subtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-bright px-5 py-3 font-sans text-body font-[700] text-abyss transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FiUploadCloud className="h-4 w-4" />
          {isUploading ? t.admin.gallery.uploading : t.admin.gallery.uploadButton}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
      </div>

      {error && <p className="mb-4 font-sans text-caption text-[#e0798f]">{error}</p>}

      {images.length === 0 ? (
        <p className="font-sans text-caption text-mist">{emptyLabel}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {images.map((image) => (
            <ImageCard key={image.id} image={image} />
          ))}
        </div>
      )}
    </div>
  )
}

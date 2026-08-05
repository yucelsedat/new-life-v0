import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { FiCheck, FiClipboard, FiTrash2, FiUploadCloud } from 'react-icons/fi'
import { useT } from '../../i18n'
import { useGalleryImages, type GalleryScope } from '../../hooks/useGalleryImages'
import { useImagePaste } from '../../hooks/useImagePaste'
import type { GalleryImage } from '../../types/world'
import { formatFileSize, formatRelativeDate } from '../../utils/helpers'
import DeleteImagesModal from './DeleteImagesModal'

interface ImageLibrarySectionProps {
  title: string
  subtitle: string
  emptyLabel: string
  /** Which images this section shows — and, on upload, which scope they are filed under. */
  scope: GalleryScope
}

interface ImageCardProps {
  image: GalleryImage
  isSelected: boolean
  onToggle: () => void
}

function ImageCard({ image, isSelected, onToggle }: ImageCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isSelected}
      className={`group relative overflow-hidden rounded-2xl border bg-black/30 text-left backdrop-blur-xl transition ${
        isSelected ? 'border-gold-bright ring-2 ring-gold-bright/40' : 'border-white/10 hover:border-white/25'
      }`}
    >
      <img src={image.url} alt={image.originalName} className="aspect-square w-full object-cover" />

      <span
        className={`absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border transition ${
          isSelected
            ? 'border-gold-bright bg-gold-bright text-abyss'
            : 'border-white/40 bg-black/40 text-transparent opacity-0 group-hover:opacity-100'
        }`}
      >
        <FiCheck className="h-3.5 w-3.5" />
      </span>

      <span className="block px-4 py-3">
        <span className="block truncate font-sans text-caption font-[700] text-white/85">{image.originalName}</span>
        <span className="font-mono text-micro text-mist">
          {formatFileSize(image.sizeBytes)} · {formatRelativeDate(image.uploadedAt)}
        </span>
      </span>
    </button>
  )
}

export default function ImageLibrarySection({ title, subtitle, emptyLabel, scope }: ImageLibrarySectionProps) {
  const t = useT()
  const { images, refetch } = useGalleryImages(scope)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { worldId, kind } = scope

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return

      const formData = new FormData()
      files.forEach((file) => formData.append('images', file))
      if (worldId) formData.append('worldId', worldId)
      if (kind) formData.append('kind', kind)

      setIsUploading(true)
      setError(null)
      setNotice(null)
      try {
        const response = await fetch('/api/gallery', { method: 'POST', body: formData })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        await refetch()
      } catch {
        setError(t.admin.gallery.uploadError)
      } finally {
        setIsUploading(false)
      }
    },
    [worldId, kind, refetch, t],
  )

  const { zoneRef, isPasteTarget } = useImagePaste<HTMLDivElement>(uploadFiles)

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!files || files.length === 0) return
    await uploadFiles(Array.from(files))
    event.target.value = ''
  }

  // A refetch (or another section's delete) can drop images out from under the selection.
  useEffect(() => {
    setSelectedIds((current) => {
      const visible = new Set(images.map((image) => image.id))
      const next = current.filter((id) => visible.has(id))
      return next.length === current.length ? current : next
    })
  }, [images])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  async function handleDelete() {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const response = await fetch('/api/gallery', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      })
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      const result = (await response.json()) as { deleted: string[]; skipped: { id: string }[] }

      setNotice(
        result.skipped.length > 0
          ? t.admin.gallery.deleteSkipped.replace('{n}', String(result.skipped.length))
          : null,
      )
      setSelectedIds(result.skipped.map((item) => item.id))
      setIsConfirmOpen(false)
      await refetch()
    } catch {
      setDeleteError(t.admin.gallery.deleteError)
    } finally {
      setIsDeleting(false)
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
      {notice && <p className="mb-4 font-sans text-caption text-gold-bright">{notice}</p>}

      <div
        ref={zoneRef}
        tabIndex={0}
        role="group"
        aria-label={title}
        className={`rounded-2xl border border-dashed p-4 outline-none transition ${
          isPasteTarget ? 'border-gold-bright/60 bg-gold-bright/[0.04]' : 'border-white/10'
        }`}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-sans text-caption text-mist">
            <FiClipboard className="h-3.5 w-3.5" />
            {isPasteTarget ? t.admin.gallery.pasteActive : t.admin.gallery.pasteHint}
          </span>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-sans text-caption font-[700] text-white/85">
                {t.admin.gallery.selectedCount.replace('{n}', String(selectedIds.length))}
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds(images.map((image) => image.id))}
                className="font-sans text-caption text-white/60 underline-offset-4 transition hover:text-white hover:underline"
              >
                {t.admin.gallery.selectAll}
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="font-sans text-caption text-white/60 underline-offset-4 transition hover:text-white hover:underline"
              >
                {t.admin.gallery.clearSelection}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null)
                  setIsConfirmOpen(true)
                }}
                className="flex items-center gap-2 rounded-xl bg-[#e0798f] px-4 py-2 font-sans text-caption font-[700] text-abyss transition hover:brightness-110"
              >
                <FiTrash2 className="h-3.5 w-3.5" />
                {t.admin.gallery.deleteButton}
              </button>
            </div>
          )}
        </div>

        {images.length === 0 ? (
          <p className="font-sans text-caption text-mist">{emptyLabel}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {images.map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                isSelected={selectedSet.has(image.id)}
                onToggle={() => toggleSelected(image.id)}
              />
            ))}
          </div>
        )}
      </div>

      <DeleteImagesModal
        open={isConfirmOpen}
        count={selectedIds.length}
        isDeleting={isDeleting}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  )
}

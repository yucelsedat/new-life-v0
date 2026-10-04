import { useState } from 'react'
import { FiTrash2 } from 'react-icons/fi'
import { useT } from '../../i18n'
import type { GalleryImage } from '../../types/world'

interface PickerGridProps {
  /** The images on offer — already narrowed down to what this picker may use. */
  images: GalleryImage[]
  /** True when the library itself holds nothing, as opposed to everything in it being used. */
  libraryEmpty: boolean
  /** The picked images, in picking order. */
  selectedUrls: string[]
  /** Show each picked image's place in the order — for a picker that takes several. */
  numbered?: boolean
  onPick: (image: GalleryImage) => void
  /** The image is gone from the library for good; awaited, so the tile leaves without a flash. */
  onDeleted: (image: GalleryImage) => void | Promise<void>
}

/**
 * The image tiles of a picker. A tile is picked by clicking it; hovering it brings up a
 * bin that deletes the image from the world's assets. Deleting cannot be undone, and a
 * dialog on top of a dialog would be heavy for it, so the tile itself asks first.
 */
export default function PickerGrid({
  images,
  libraryEmpty,
  selectedUrls,
  numbered = false,
  onPick,
  onDeleted,
}: PickerGridProps) {
  const t = useT()
  /** The image whose tile is asking whether to delete it. */
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function handleDelete(image: GalleryImage) {
    setIsDeleting(true)
    setProblem(null)
    try {
      const response = await fetch('/api/gallery', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [image.id] }),
      })
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      const result = (await response.json()) as { deleted: string[] }
      // The server leaves an image alone if something came to use it in the meantime.
      if (result.deleted.includes(image.id)) await onDeleted(image)
      else setProblem(t.admin.editor.modal.deleteInUse)
    } catch {
      setProblem(t.admin.gallery.deleteError)
    } finally {
      setIsDeleting(false)
      setConfirmingId(null)
    }
  }

  if (images.length === 0) {
    return (
      <p className="font-sans text-caption text-mist">
        {libraryEmpty ? t.admin.editor.modal.empty : t.admin.editor.modal.allUsed}
      </p>
    )
  }

  return (
    <>
      {problem && <p className="mb-3 font-sans text-caption text-[#e0798f]">{problem}</p>}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {images.map((image) => {
          const order = selectedUrls.indexOf(image.url)
          const isSelected = order !== -1
          return (
            <div key={image.id} className="group relative">
              <button
                type="button"
                onClick={() => {
                  setConfirmingId(null)
                  onPick(image)
                }}
                className={`relative block w-full overflow-hidden rounded-xl border-2 transition ${
                  isSelected ? 'border-gold-bright' : 'border-transparent hover:border-white/20'
                }`}
              >
                <img src={image.url} alt={image.originalName} className="aspect-square w-full object-cover" />
                {numbered && isSelected && (
                  <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gold-bright font-mono text-caption font-[700] text-abyss">
                    {order + 1}
                  </span>
                )}
              </button>

              {confirmingId === image.id ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-black/85 p-2 text-center">
                  <span className="font-sans text-micro font-[700] text-white/90">
                    {isDeleting ? t.admin.gallery.deleting : t.admin.editor.modal.deleteQuestion}
                  </span>
                  {!isDeleting && (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDelete(image)}
                        className="rounded-lg bg-[#e0798f] px-2.5 py-1 font-sans text-micro font-[800] text-abyss transition hover:brightness-110"
                      >
                        {t.admin.editor.modal.deleteConfirm}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="rounded-lg border border-white/20 px-2.5 py-1 font-sans text-micro text-white/80 transition hover:border-white/40"
                      >
                        {t.admin.editor.modal.cancel}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                // An image something already shows cannot go — the server would refuse it too.
                <button
                  type="button"
                  disabled={image.inUse || isDeleting}
                  aria-label={t.admin.editor.modal.deleteImage}
                  title={image.inUse ? t.admin.gallery.inUseTooltip : t.admin.editor.modal.deleteImage}
                  onClick={() => setConfirmingId(image.id)}
                  className="absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white/85 opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100 enabled:hover:bg-[#e0798f] enabled:hover:text-abyss disabled:cursor-not-allowed disabled:text-white/35"
                >
                  <FiTrash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

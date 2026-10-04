import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import { FiClipboard, FiUploadCloud } from 'react-icons/fi'
import { useT } from '../../i18n'
import type { GalleryScope } from '../../hooks/useGalleryImages'
import { useImagePaste } from '../../hooks/useImagePaste'
import { useImageUpload } from '../../hooks/useImageUpload'
import type { GalleryImage } from '../../types/world'

interface PickerUploadProps {
  /** Where the images are filed — the library the picker is showing. */
  scope: GalleryScope
  /** The images just added, once they are on the server. */
  onUploaded: (images: GalleryImage[]) => void
}

/**
 * Adds images to a picker's library without leaving the picker: an upload button, and
 * Ctrl+V for an image on the clipboard. Rendered only while its picker is open, so the
 * one picker on screen is the only paste zone and takes the paste wherever the focus is.
 */
export default function PickerUpload({ scope, onUploaded }: PickerUploadProps) {
  const t = useT()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { upload, isUploading, uploadFailed } = useImageUpload(scope)
  const [addedCount, setAddedCount] = useState(0)

  const handleFiles = useCallback(
    async (files: File[]) => {
      const created = await upload(files)
      setAddedCount(created.length)
      if (created.length > 0) onUploaded(created)
    },
    [upload, onUploaded],
  )

  const { zoneRef } = useImagePaste<HTMLDivElement>(handleFiles)

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    // Cleared first, so picking the same file again still counts as a change.
    event.target.value = ''
    await handleFiles(files)
  }

  const status = isUploading
    ? { text: t.admin.gallery.uploading, tone: 'text-mist' }
    : uploadFailed
      ? { text: t.admin.gallery.uploadError, tone: 'text-[#e0798f]' }
      : addedCount > 0
        ? { text: t.admin.editor.modal.uploaded.replace('{n}', String(addedCount)), tone: 'text-gold-bright' }
        : { text: t.admin.editor.modal.pasteHint, tone: 'text-mist' }

  return (
    <div ref={zoneRef} className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-3">
      <span role="status" className={`flex items-center gap-2 font-sans text-caption ${status.tone}`}>
        <FiClipboard className="h-3.5 w-3.5 shrink-0" />
        {status.text}
      </span>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="flex shrink-0 items-center gap-2 rounded-xl border border-white/15 px-4 py-2 font-sans text-caption font-[700] text-white/80 transition hover:border-gold-bright hover:text-gold-bright disabled:cursor-not-allowed disabled:opacity-40"
      >
        <FiUploadCloud className="h-3.5 w-3.5" />
        {t.admin.gallery.uploadButton}
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
    </div>
  )
}

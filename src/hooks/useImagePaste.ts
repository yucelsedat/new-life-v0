import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Clipboard-paste uploading for image libraries.
 *
 * A page can host several libraries at once (world assets shows scenes + characters),
 * so a paste has to land in exactly one of them. Every mounted zone registers here and
 * they all agree on the same target:
 *   1. the zone containing the focused element, otherwise
 *   2. the only zone on the page, if there is just one.
 * When several zones are mounted and none has focus the paste is ignored — the user
 * clicks the zone they mean first.
 */
interface PasteZone {
  readonly el: HTMLElement | null
}

const zones: PasteZone[] = []
const registryListeners = new Set<() => void>()

function notifyRegistryChanged() {
  registryListeners.forEach((listener) => listener())
}

function findTargetZone(): PasteZone | null {
  const focused = zones.find((zone) => zone.el?.contains(document.activeElement))
  if (focused) return focused
  return zones.length === 1 ? zones[0] : null
}

/** Clipboard images arrive without a meaningful filename — give them a readable one. */
function nameForPastedFile(file: File, index: number): string {
  const hasRealName = file.name && file.name !== 'image.png' && file.name !== 'blob'
  if (hasRealName) return file.name
  const extension = file.type.split('/')[1]?.replace('+xml', '') ?? 'png'
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '')
  return `pano-${stamp}${index > 0 ? `-${index + 1}` : ''}.${extension}`
}

function imageFilesFrom(clipboard: DataTransfer | null): File[] {
  if (!clipboard) return []
  const items = Array.from(clipboard.items ?? [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null)

  const files = items.length > 0 ? items : Array.from(clipboard.files).filter((f) => f.type.startsWith('image/'))
  return files.map((file, index) => new File([file], nameForPastedFile(file, index), { type: file.type }))
}

export interface UseImagePasteResult<T extends HTMLElement> {
  /** Attach to the element that represents this library's paste zone. */
  zoneRef: React.RefObject<T | null>
  /** True when a Ctrl/Cmd+V right now would upload into this zone. */
  isPasteTarget: boolean
}

export function useImagePaste<T extends HTMLElement>(onImagesPasted: (files: File[]) => void): UseImagePasteResult<T> {
  const zoneRef = useRef<T | null>(null)
  const [isPasteTarget, setIsPasteTarget] = useState(false)

  // Keep the latest callback without re-subscribing the document listener on every render.
  const callbackRef = useRef(onImagesPasted)
  callbackRef.current = onImagesPasted

  const syncTarget = useCallback(() => {
    setIsPasteTarget(findTargetZone()?.el === zoneRef.current && zoneRef.current !== null)
  }, [])

  useEffect(() => {
    const zone: PasteZone = {
      get el() {
        return zoneRef.current
      },
    }
    zones.push(zone)
    registryListeners.add(syncTarget)
    notifyRegistryChanged()

    return () => {
      const index = zones.indexOf(zone)
      if (index >= 0) zones.splice(index, 1)
      registryListeners.delete(syncTarget)
      notifyRegistryChanged()
    }
  }, [syncTarget])

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      if (findTargetZone()?.el !== zoneRef.current) return
      const files = imageFilesFrom(event.clipboardData)
      if (files.length === 0) return
      event.preventDefault()
      callbackRef.current(files)
    }

    document.addEventListener('paste', handlePaste)
    document.addEventListener('focusin', syncTarget)
    document.addEventListener('focusout', syncTarget)

    return () => {
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('focusin', syncTarget)
      document.removeEventListener('focusout', syncTarget)
    }
  }, [syncTarget])

  return { zoneRef, isPasteTarget }
}

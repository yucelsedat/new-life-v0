import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'

/** How far holding C leans in — a closer look, not a different shot. */
const ZOOM_SCALE = 2

interface UseHoldZoomOptions {
  /** False while a modal or submission owns the screen. */
  enabled: boolean
}

/**
 * Holding C leans in on the scene towards the cursor, and letting go eases back out.
 * While it is held the zoom follows the cursor, so moving it looks round the picture.
 * Like the other scene keys it reads the letter, not the key position, and leaves
 * keystrokes aimed at a field alone.
 *
 * Returns the style for the layer that zooms — the image and whatever is pinned onto
 * it, so pins stay on the spot of the picture they mark. The screen's controls belong
 * outside it.
 */
export function useHoldZoom(layerRef: RefObject<HTMLElement | null>, { enabled }: UseHoldZoomOptions): CSSProperties {
  const [zoomed, setZoomed] = useState(false)
  const zoomedRef = useRef(false)
  zoomedRef.current = zoomed
  const pointerRef = useRef<{ x: number; y: number } | null>(null)

  /**
   * Lean the zoom towards the cursor. Written straight onto the layer rather than through
   * state, so following the cursor does not re-render the page on every move. The point
   * is left as it is on letting go, so the picture eases out from where it was.
   */
  function aimAtPointer() {
    const layer = layerRef.current
    if (!layer) return
    // Measured on the unscaled box around the layer: the layer's own box grows with the zoom.
    const rect = (layer.parentElement ?? layer).getBoundingClientRect()
    const pointer = pointerRef.current
    const x = pointer ? ((pointer.x - rect.left) / rect.width) * 100 : 50
    const y = pointer ? ((pointer.y - rect.top) / rect.height) * 100 : 50
    // A cursor that has not moved yet, or sits off the picture, leans in on the middle.
    const inside = x >= 0 && x <= 100 && y >= 0 && y <= 100
    layer.style.transformOrigin = inside ? `${x}% ${y}%` : '50% 50%'
  }

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      pointerRef.current = { x: event.clientX, y: event.clientY }
      if (zoomedRef.current) aimAtPointer()
    }
    window.addEventListener('pointermove', handlePointerMove)
    return () => window.removeEventListener('pointermove', handlePointerMove)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!enabled) {
      setZoomed(false)
      return
    }

    function isC(event: KeyboardEvent) {
      return event.key.toLowerCase() === 'c'
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || !isC(event)) return

      const target = event.target as HTMLElement | null
      if (target?.isContentEditable) return
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      event.preventDefault()
      aimAtPointer()
      setZoomed(true)
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (isC(event)) setZoomed(false)
    }

    // A key let go while the window was not listening would leave the scene zoomed.
    function handleBlur() {
      setZoomed(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, layerRef])

  return {
    transform: `scale(${zoomed ? ZOOM_SCALE : 1})`,
    transition: 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)',
  }
}

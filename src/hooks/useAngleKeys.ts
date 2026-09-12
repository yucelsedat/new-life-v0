import { useEffect } from 'react'

interface UseAngleKeysOptions {
  /** False while a story frame, a modal or a submission owns the screen. */
  enabled: boolean
  onLookLeft: () => void
  onLookRight: () => void
}

/**
 * A and D turn the camera within the current option, alongside the on-screen arrows.
 *
 * The keys are read as the letters they produce rather than by physical position, so a
 * layout that puts A and D elsewhere still turns on the letters the player can see.
 */
export function useAngleKeys({ enabled, onLookLeft, onLookRight }: UseAngleKeysOptions) {
  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(event: KeyboardEvent) {
      // Held keys would spin the camera; one press is one turn.
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return

      // A keystroke aimed at a field is text, never a camera move.
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable) return
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      const key = event.key.toLowerCase()
      if (key !== 'a' && key !== 'd') return

      event.preventDefault()
      if (key === 'a') onLookLeft()
      else onLookRight()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onLookLeft, onLookRight])
}

import { useEffect } from 'react'

interface UseStoryKeyOptions {
  /** False while there is no story to move on, or a modal or submission owns the screen. */
  enabled: boolean
  onAdvance: () => void
}

/**
 * F moves the story on screen to its next frame, as the İlerle button does. Like A, D
 * and W, it reads the letter, not the key position, and leaves keystrokes aimed at a
 * field alone.
 */
export function useStoryKey({ enabled, onAdvance }: UseStoryKeyOptions) {
  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(event: KeyboardEvent) {
      // Held down it would race through every frame of the story at once.
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return

      const target = event.target as HTMLElement | null
      if (target?.isContentEditable) return
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      if (event.key.toLowerCase() !== 'f') return

      event.preventDefault()
      onAdvance()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onAdvance])
}

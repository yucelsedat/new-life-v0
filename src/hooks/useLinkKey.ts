import { useEffect } from 'react'

interface UseLinkKeyOptions {
  /** False while the link is not on screen, or a modal or submission owns the screen. */
  enabled: boolean
  onFollowLink: () => void
}

/**
 * W walks through the scene link of the view on screen — a view holds at most one, so
 * there is never a question of which. Like A and D, it reads the letter, not the key
 * position, and leaves keystrokes aimed at a field alone.
 */
export function useLinkKey({ enabled, onFollowLink }: UseLinkKeyOptions) {
  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(event: KeyboardEvent) {
      // Held down it would walk on through every scene after this one.
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return

      const target = event.target as HTMLElement | null
      if (target?.isContentEditable) return
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      if (event.key.toLowerCase() !== 'w') return

      event.preventDefault()
      onFollowLink()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onFollowLink])
}

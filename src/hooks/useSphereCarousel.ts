import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

const SWIPE_THRESHOLD_PX = 48

export interface SphereCarouselBind {
  onPointerDown: (event: ReactPointerEvent) => void
  onPointerMove: (event: ReactPointerEvent) => void
  onPointerUp: (event: ReactPointerEvent) => void
}

export function useSphereCarousel(count: number) {
  const [activeIndex, setActiveIndex] = useState(0)
  const startX = useRef<number | null>(null)
  const dragging = useRef(false)

  const onPointerDown = useCallback((event: ReactPointerEvent) => {
    startX.current = event.clientX
    dragging.current = true
  }, [])

  const onPointerMove = useCallback((event: ReactPointerEvent) => {
    if (!dragging.current || startX.current === null) return
    event.preventDefault()
  }, [])

  const onPointerUp = useCallback(
    (event: ReactPointerEvent) => {
      if (startX.current === null || count === 0) return
      const deltaX = event.clientX - startX.current
      dragging.current = false
      startX.current = null

      if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return

      setActiveIndex((current) => {
        const direction = deltaX < 0 ? 1 : -1
        return Math.min(count - 1, Math.max(0, current + direction))
      })
    },
    [count],
  )

  const bind: SphereCarouselBind = { onPointerDown, onPointerMove, onPointerUp }

  return { activeIndex, setActiveIndex, bind }
}

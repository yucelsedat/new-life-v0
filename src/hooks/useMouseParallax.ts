import { useEffect, useRef, type RefObject } from 'react'

export interface ParallaxRef {
  x: number
  y: number
}

export function useMouseParallax(): RefObject<ParallaxRef> {
  const pointer = useRef<ParallaxRef>({ x: 0, y: 0 })

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1
    }

    window.addEventListener('pointermove', handlePointerMove)
    return () => window.removeEventListener('pointermove', handlePointerMove)
  }, [])

  return pointer
}

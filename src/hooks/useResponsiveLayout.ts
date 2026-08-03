import { useEffect, useState } from 'react'
import type { LayoutBreakpoint, QualityTier } from '../types/world'
import { BREAKPOINTS } from '../utils/constants'

function resolveBreakpoint(width: number): LayoutBreakpoint {
  if (width < BREAKPOINTS.mobile) return 'mobile'
  if (width < BREAKPOINTS.tablet) return 'tablet'
  return 'desktop'
}

export interface ResponsiveLayout {
  breakpoint: LayoutBreakpoint
  satelliteQuality: QualityTier
  dpr: [number, number]
  arcSpreadScale: number
}

export function useResponsiveLayout(): ResponsiveLayout {
  const [breakpoint, setBreakpoint] = useState<LayoutBreakpoint>(() =>
    typeof window === 'undefined' ? 'desktop' : resolveBreakpoint(window.innerWidth),
  )

  useEffect(() => {
    function handleResize() {
      setBreakpoint(resolveBreakpoint(window.innerWidth))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (breakpoint === 'mobile') {
    return { breakpoint, satelliteQuality: 'lite', dpr: [1, 1.5], arcSpreadScale: 0.55 }
  }
  if (breakpoint === 'tablet') {
    return { breakpoint, satelliteQuality: 'satellite', dpr: [1, 1.75], arcSpreadScale: 0.75 }
  }
  return { breakpoint, satelliteQuality: 'satellite', dpr: [1, 2], arcSpreadScale: 1 }
}

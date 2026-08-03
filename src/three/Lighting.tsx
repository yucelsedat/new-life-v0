import { useEffect } from 'react'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
import { COLORS } from '../utils/constants'

export default function Lighting() {
  useEffect(() => {
    RectAreaLightUniformsLib.init()
  }, [])

  return (
    <>
      <ambientLight intensity={0.18} color={COLORS.abyss} />
      <spotLight
        position={[2.5, 6, 3]}
        angle={0.5}
        penumbra={0.9}
        intensity={18}
        color={COLORS.goldBright}
        distance={20}
        decay={2}
      />
      <rectAreaLight position={[-4, 1.5, -2]} width={4} height={6} intensity={3.5} color={COLORS.ice} />
      <rectAreaLight position={[4, 1, -3]} width={3} height={5} intensity={2.5} color={COLORS.gold} />
    </>
  )
}

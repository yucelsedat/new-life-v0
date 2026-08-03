import { Sparkles } from '@react-three/drei'
import { COLORS } from '../utils/constants'

export default function BackgroundParticles() {
  return (
    <Sparkles
      count={140}
      scale={[16, 8, 12]}
      size={1.4}
      speed={0.15}
      opacity={0.45}
      noise={[0.4, 0.6, 0.4]}
      color={COLORS.goldBright}
      position={[0, 1, -2]}
    />
  )
}

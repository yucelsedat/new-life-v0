import { Bloom, DepthOfField, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

export default function Effects() {
  return (
    <EffectComposer multisampling={0} depthBuffer>
      <Bloom mipmapBlur luminanceThreshold={0.78} luminanceSmoothing={0.3} intensity={0.9} />
      <DepthOfField focusDistance={0.012} focalLength={0.035} bokehScale={2.4} />
      <Vignette eskil={false} offset={0.25} darkness={0.85} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.035} />
    </EffectComposer>
  )
}

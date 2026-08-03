import { useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { easing } from 'maath'
import { CAMERA } from '../utils/constants'
import type { ParallaxRef } from '../hooks/useMouseParallax'
import type { CameraFocusState } from './cameraFocus'

interface CameraRigProps {
  parallax: RefObject<ParallaxRef>
  focus: RefObject<CameraFocusState>
}

const targetVector = new THREE.Vector3()
const lookAtVector = new THREE.Vector3()

export default function CameraRig({ parallax, focus }: CameraRigProps) {
  const { camera } = useThree()
  const elapsed = useRef(0)

  useFrame((_, delta) => {
    elapsed.current += delta
    const t = elapsed.current
    const focusState = focus.current
    const settleFactor = focusState.dollying ? 0.15 : 1

    const idleX = Math.sin(t * 0.12) * 0.4 * settleFactor
    const idleY = Math.cos(t * 0.09) * 0.18 * settleFactor
    const parallaxX = parallax.current.x * CAMERA.parallaxStrength
    const parallaxY = -parallax.current.y * CAMERA.parallaxStrength * 0.6
    const distance = focusState.dollying ? CAMERA.dollyDistance : CAMERA.restDistance

    targetVector.set(
      focusState.position.x + idleX + parallaxX,
      focusState.position.y + idleY + parallaxY + 0.4,
      focusState.position.z + distance,
    )

    const lambda = focusState.dollying ? CAMERA.dampingLambda * 0.5 : CAMERA.dampingLambda
    easing.damp3(camera.position, targetVector, 1 / lambda, delta)

    lookAtVector.set(focusState.position.x, focusState.position.y, focusState.position.z)
    camera.lookAt(lookAtVector)
  })

  return null
}

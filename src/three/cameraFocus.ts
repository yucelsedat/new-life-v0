import * as THREE from 'three'

export interface CameraFocusState {
  position: THREE.Vector3
  dollying: boolean
}

export function createCameraFocus(): CameraFocusState {
  return { position: new THREE.Vector3(0, 0, 0), dollying: false }
}

import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import type { SceneId } from '../types/world'
import { getProceduralSceneTexture } from '../utils/proceduralScenes'
import { getSceneGeometry } from '../three/Materials'

interface ScenePreviewProps {
  sceneId: SceneId
  sceneImageUrl: string | null
}

function ProceduralPreview({ sceneId }: { sceneId: SceneId }) {
  const texture = useMemo(() => getProceduralSceneTexture(sceneId), [sceneId])
  return (
    <mesh geometry={getSceneGeometry()}>
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}

function RemotePreview({ url }: { url: string }) {
  const texture = useTexture(url)
  return (
    <mesh geometry={getSceneGeometry()}>
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}

export default function ScenePreview({ sceneId, sceneImageUrl }: ScenePreviewProps) {
  if (sceneImageUrl) return <RemotePreview url={sceneImageUrl} />
  return <ProceduralPreview sceneId={sceneId} />
}

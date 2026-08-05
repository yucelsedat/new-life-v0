import { useCallback, useEffect, useState } from 'react'
import type { SceneLink, WorldScene, WorldSceneGraph } from '../types/world'

export interface UseWorldCanvasResult {
  scenes: WorldScene[]
  links: SceneLink[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  createScene: (name: string, imageUrl: string, canvasX: number, canvasY: number) => Promise<void>
  connectScenes: (originId: string, targetId: string, label: string) => Promise<void>
  updateScenePosition: (sceneId: string, canvasX: number, canvasY: number) => void
}

export function useWorldCanvas(worldId: string): UseWorldCanvasResult {
  const [scenes, setScenes] = useState<WorldScene[]>([])
  const [links, setLinks] = useState<SceneLink[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGraph = useCallback(async () => {
    try {
      const response = await fetch(`/api/scenes/graph?worldId=${worldId}`)
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      const data = (await response.json()) as WorldSceneGraph
      setScenes(data.scenes)
      setLinks(data.links)
    } catch {
      setError('load-failed')
    } finally {
      setIsLoading(false)
    }
  }, [worldId])

  useEffect(() => {
    fetchGraph()
  }, [fetchGraph])

  const createScene = useCallback(
    async (name: string, imageUrl: string, canvasX: number, canvasY: number) => {
      setError(null)
      try {
        const response = await fetch('/api/scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worldId, name, imageUrl, canvasX, canvasY }),
        })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        const scene = (await response.json()) as WorldScene
        setScenes((prev) => [...prev, scene])
      } catch {
        setError('create-failed')
      }
    },
    [worldId],
  )

  const connectScenes = useCallback(async (originId: string, targetId: string, label: string) => {
    setError(null)
    try {
      const response = await fetch(`/api/scenes/${originId}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetSceneId: targetId, label }),
      })
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      const { forwardLink, backwardLink } = (await response.json()) as {
        forwardLink: SceneLink
        backwardLink: SceneLink
      }
      setLinks((prev) => [...prev, forwardLink, backwardLink])
    } catch {
      setError('connect-failed')
    }
  }, [])

  const updateScenePosition = useCallback((sceneId: string, canvasX: number, canvasY: number) => {
    setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, canvasX, canvasY } : s)))

    fetch(`/api/scenes/${sceneId}/position`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canvasX, canvasY }),
    }).catch(() => {})
  }, [])

  return { scenes, links, isLoading, error, refetch: fetchGraph, createScene, connectScenes, updateScenePosition }
}

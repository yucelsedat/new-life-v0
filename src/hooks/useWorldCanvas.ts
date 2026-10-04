import { useCallback, useEffect, useState } from 'react'
import type { SceneLink, WorldScene, WorldSceneGraph } from '../types/world'

export interface UseWorldCanvasResult {
  scenes: WorldScene[]
  links: SceneLink[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  createScene: (
    name: string,
    imageUrl: string,
    canvasX: number,
    canvasY: number,
    heading: number,
    magnetic: boolean,
  ) => Promise<void>
  connectScenes: (originId: string, targetId: string, label: string) => Promise<void>
  updateScenePosition: (sceneId: string, canvasX: number, canvasY: number) => void
  /** Turn a hand on a scene's ring: the scene's own (`angleId` null) or one of its angles. */
  updateHeading: (sceneId: string, angleId: string | null, heading: number) => void
  /** Make a hand magnetic, or plain again. `angleId` null is the scene's own. */
  updateMagnetic: (sceneId: string, angleId: string | null, magnetic: boolean) => void
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
    async (
      name: string,
      imageUrl: string,
      canvasX: number,
      canvasY: number,
      heading: number,
      magnetic: boolean,
    ) => {
      setError(null)
      try {
        const response = await fetch('/api/scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worldId, name, imageUrl, canvasX, canvasY, heading, magnetic }),
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

  /** Changes one hand in place: the scene's own when `angleId` is null, else that angle's. */
  const patchHand = useCallback(
    (sceneId: string, angleId: string | null, change: { heading: number } | { magnetic: boolean }) => {
      setScenes((prev) =>
        prev.map((scene) => {
          if (scene.id !== sceneId) return scene
          if (angleId === null) return { ...scene, ...change }
          const angles = Object.fromEntries(
            Object.entries(scene.angles ?? {}).map(([optionKey, optionAngles]) => [
              optionKey,
              optionAngles.map((angle) => (angle.id === angleId ? { ...angle, ...change } : angle)),
            ]),
          )
          return { ...scene, angles }
        }),
      )
    },
    [],
  )

  const updateHeading = useCallback(
    (sceneId: string, angleId: string | null, heading: number) => {
      patchHand(sceneId, angleId, { heading })

      const url =
        angleId === null ? `/api/scenes/${sceneId}/heading` : `/api/scenes/${sceneId}/angles/${angleId}/heading`
      fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heading }),
      })
        // The server refuses a mark another image already holds; the ring then goes back
        // to what is actually stored.
        .then((response) => (response.ok ? undefined : fetchGraph()))
        .catch(() => {})
    },
    [fetchGraph, patchHand],
  )

  const updateMagnetic = useCallback(
    (sceneId: string, angleId: string | null, magnetic: boolean) => {
      patchHand(sceneId, angleId, { magnetic })

      const url =
        angleId === null ? `/api/scenes/${sceneId}/magnetic` : `/api/scenes/${sceneId}/angles/${angleId}/magnetic`
      fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ magnetic }),
      }).catch(() => {})
    },
    [patchHand],
  )

  return {
    scenes,
    links,
    isLoading,
    error,
    refetch: fetchGraph,
    createScene,
    connectScenes,
    updateScenePosition,
    updateHeading,
    updateMagnetic,
  }
}

import { useCallback, useEffect, useState } from 'react'
import type { RandomConnection, SceneAngle, SceneLink, WorldScene, WorldSceneGraph } from '../types/world'

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
  /**
   * Link two scenes both ways on random free views, without asking for a name. Resolves
   * with how each end came out, or null when the request failed.
   */
  connectScenesAtRandom: (originId: string, targetId: string) => Promise<RandomConnection | null>
  updateScenePosition: (sceneId: string, canvasX: number, canvasY: number) => void
  /**
   * Link one view of a scene to another scene that already exists — one way only.
   * Resolves to the link, or null if it was refused.
   */
  linkView: (sceneId: string, angleOffset: number, targetId: string) => Promise<SceneLink | null>
  /** Remove one link, leaving any link back in place. Resolves to whether it went through. */
  deleteLink: (linkId: string) => Promise<boolean>
  /** Remove every link between two scenes, both ways. Resolves to whether it went through. */
  disconnectScenes: (sceneId: string, targetId: string) => Promise<boolean>
  /**
   * A new scene reached from one view of `sceneId` — `angleOffset` is the view its link
   * hangs off. The rest describes the new scene: its image, the way that looks, and where
   * its ring goes on the canvas.
   */
  createLinkedScene: (
    sceneId: string,
    angleOffset: number,
    scene: { name: string; imageUrl: string; heading: number; magnetic: boolean; canvasX: number; canvasY: number },
  ) => Promise<void>
  /** Add an option to a scene: the same place at a later moment of the world's day. */
  createVariant: (sceneId: string, imageUrl: string) => Promise<void>
  /** Add an angle to a scene's base option. Resolves to it, or null if it was refused. */
  createAngle: (sceneId: string, imageUrl: string, heading: number, magnetic: boolean) => Promise<SceneAngle | null>
  deleteAngle: (sceneId: string, angleId: string) => Promise<void>
  /** Replace the story of one view of a scene's base option. No images clears it. */
  saveStory: (sceneId: string, angleOffset: number, imageUrls: string[]) => Promise<void>
  /** Swap the image behind a view: the scene's own (`angleId` null) or one of its angles. */
  changeViewImage: (sceneId: string, angleId: string | null, imageUrl: string) => Promise<void>
  /** Hang a link on another view of its scene. */
  moveLink: (linkId: string, angleOffset: number) => Promise<void>
  /** Turn a hand on a scene's ring: the scene's own (`angleId` null) or one of its angles. */
  updateHeading: (sceneId: string, angleId: string | null, heading: number) => void
  /** Make a hand magnetic, or plain again. `angleId` null is the scene's own. */
  updateMagnetic: (sceneId: string, angleId: string | null, magnetic: boolean) => void
}

/** One change sent to the server. Resolves with its answer, or null when it was refused or never arrived. */
async function send<T>(url: string, method: string, body?: unknown): Promise<T | null> {
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return response.ok ? ((await response.json()) as T) : null
  } catch {
    return null
  }
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

  const connectScenesAtRandom = useCallback(async (originId: string, targetId: string) => {
    setError(null)
    try {
      const response = await fetch(`/api/scenes/${originId}/connect/random`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetSceneId: targetId }),
      })
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      const connection = (await response.json()) as RandomConnection
      const created = [connection.forward.link, connection.backward.link].filter((link) => link !== null)
      setLinks((prev) => [...prev, ...created])
      return connection
    } catch {
      setError('connect-failed')
      return null
    }
  }, [])

  /**
   * Sends a change the editor also makes, then reads the graph again: these touch angles,
   * options, stories and links at once, and the server's answer is the one to trust.
   */
  const change = useCallback(
    async <T>(failure: string, url: string, method: string, body?: unknown): Promise<T | null> => {
      setError(null)
      const result = await send<T>(url, method, body)
      if (result === null) setError(failure)
      else await fetchGraph()
      return result
    },
    [fetchGraph],
  )

  const linkView = useCallback(
    (sceneId: string, angleOffset: number, targetId: string) =>
      change<SceneLink>('connect-failed', `/api/scenes/${sceneId}/links/existing`, 'POST', {
        targetSceneId: targetId,
        angleOffset,
      }),
    [change],
  )

  const deleteLink = useCallback(
    async (linkId: string) => (await change('delete-failed', `/api/scene-links/${linkId}`, 'DELETE')) !== null,
    [change],
  )

  const disconnectScenes = useCallback(
    async (sceneId: string, targetId: string) =>
      (await change('delete-failed', `/api/scenes/${sceneId}/connect/${targetId}`, 'DELETE')) !== null,
    [change],
  )

  const createLinkedScene = useCallback<UseWorldCanvasResult['createLinkedScene']>(
    async (sceneId, angleOffset, { name, imageUrl, heading, magnetic, canvasX, canvasY }) => {
      await change('create-failed', `/api/scenes/${sceneId}/links`, 'POST', {
        label: name,
        imageUrl,
        angleOffset,
        heading,
        magnetic,
        canvasX,
        canvasY,
      })
    },
    [change],
  )

  const createVariant = useCallback(
    async (sceneId: string, imageUrl: string) => {
      await change('create-failed', `/api/scenes/${sceneId}/variants`, 'POST', { imageUrl })
    },
    [change],
  )

  const createAngle = useCallback(
    (sceneId: string, imageUrl: string, heading: number, magnetic: boolean) =>
      change<SceneAngle>('create-failed', `/api/scenes/${sceneId}/angles`, 'POST', { imageUrl, heading, magnetic }),
    [change],
  )

  const deleteAngle = useCallback(
    async (sceneId: string, angleId: string) => {
      await change('delete-failed', `/api/scenes/${sceneId}/angles/${angleId}`, 'DELETE')
    },
    [change],
  )

  const saveStory = useCallback(
    async (sceneId: string, angleOffset: number, imageUrls: string[]) => {
      await change('create-failed', `/api/scenes/${sceneId}/story`, 'PUT', { angleOffset, imageUrls })
    },
    [change],
  )

  const changeViewImage = useCallback(
    async (sceneId: string, angleId: string | null, imageUrl: string) => {
      const url = angleId === null ? `/api/scenes/${sceneId}/image` : `/api/scenes/${sceneId}/angles/${angleId}/image`
      await change('update-failed', url, 'PATCH', { imageUrl })
    },
    [change],
  )

  const moveLink = useCallback(
    async (linkId: string, angleOffset: number) => {
      await change('update-failed', `/api/scene-links/${linkId}/angle`, 'PATCH', { angleOffset })
    },
    [change],
  )

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
    connectScenesAtRandom,
    linkView,
    deleteLink,
    disconnectScenes,
    createLinkedScene,
    createVariant,
    createAngle,
    deleteAngle,
    saveStory,
    changeViewImage,
    moveLink,
    updateScenePosition,
    updateHeading,
    updateMagnetic,
  }
}

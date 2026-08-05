import { useCallback, useEffect, useState } from 'react'
import type { SceneLink, SceneVariant, StoryFrame, WorldScene } from '../types/world'

export interface UseWorldEditorResult {
  scenes: WorldScene[]
  currentScene: WorldScene | null
  isLoading: boolean
  error: string | null
  createFirstScene: (name: string, imageUrl: string) => Promise<void>
  createLink: (label: string, imageUrl: string, positionX?: number, positionY?: number) => Promise<void>
  createVariant: (imageUrl: string) => Promise<void>
  saveStory: (variantKey: string, imageUrls: string[]) => Promise<void>
  changeOptionImage: (variantKey: string, imageUrl: string) => Promise<void>
  goToScene: (sceneId: string) => Promise<void>
  updateLinkPosition: (linkId: string, positionX: number, positionY: number) => void
}

async function fetchScene(sceneId: string): Promise<WorldScene> {
  const response = await fetch(`/api/scenes/${sceneId}`)
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return (await response.json()) as WorldScene
}

export function useWorldEditor(worldId: string): UseWorldEditorResult {
  const [scenes, setScenes] = useState<WorldScene[]>([])
  const [currentScene, setCurrentScene] = useState<WorldScene | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const response = await fetch(`/api/scenes?worldId=${worldId}`, { signal: controller.signal })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        const list = (await response.json()) as WorldScene[]
        setScenes(list)

        if (list.length > 0) {
          const first = await fetchScene(list[0].id)
          setCurrentScene(first)
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError('load-failed')
      } finally {
        setIsLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [worldId])

  const createFirstScene = useCallback(
    async (name: string, imageUrl: string) => {
      setError(null)
      try {
        const response = await fetch('/api/scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worldId, name, imageUrl }),
        })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        const scene = (await response.json()) as WorldScene
        setScenes((prev) => [...prev, scene])
        setCurrentScene({ ...scene, links: [] })
      } catch {
        setError('create-failed')
      }
    },
    [worldId],
  )

  const createLink = useCallback(
    async (label: string, imageUrl: string, positionX = 50, positionY = 50) => {
      if (!currentScene) return
      setError(null)
      try {
        const response = await fetch(`/api/scenes/${currentScene.id}/links`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label, imageUrl, positionX, positionY }),
        })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        const { scene, link } = (await response.json()) as { scene: WorldScene; link: SceneLink }
        setScenes((prev) => [...prev, scene])
        setCurrentScene((prev) => (prev ? { ...prev, links: [...(prev.links ?? []), link] } : prev))
      } catch {
        setError('create-failed')
      }
    },
    [currentScene],
  )

  const createVariant = useCallback(
    async (imageUrl: string) => {
      if (!currentScene) return
      setError(null)
      try {
        const response = await fetch(`/api/scenes/${currentScene.id}/variants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl }),
        })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        const variant = (await response.json()) as SceneVariant
        setCurrentScene((prev) =>
          prev ? { ...prev, variants: [...(prev.variants ?? []), variant] } : prev,
        )
      } catch {
        setError('create-failed')
      }
    },
    [currentScene],
  )

  const saveStory = useCallback(
    async (variantKey: string, imageUrls: string[]) => {
      if (!currentScene) return
      setError(null)
      try {
        const response = await fetch(`/api/scenes/${currentScene.id}/story`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variantId: variantKey, imageUrls }),
        })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        const { frames } = (await response.json()) as { variantId: string; frames: StoryFrame[] }
        setCurrentScene((prev) =>
          prev ? { ...prev, stories: { ...(prev.stories ?? {}), [variantKey]: frames } } : prev,
        )
      } catch {
        setError('create-failed')
      }
    },
    [currentScene],
  )

  /** Swap the image behind the active option — the scene itself, or one of its variants. */
  const changeOptionImage = useCallback(
    async (variantKey: string, imageUrl: string) => {
      if (!currentScene) return
      setError(null)
      const url =
        variantKey === 'base'
          ? `/api/scenes/${currentScene.id}/image`
          : `/api/scenes/${currentScene.id}/variants/${variantKey}/image`
      try {
        const response = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl }),
        })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        setCurrentScene((prev) => {
          if (!prev) return prev
          if (variantKey === 'base') return { ...prev, imageUrl }
          return {
            ...prev,
            variants: (prev.variants ?? []).map((v) => (v.id === variantKey ? { ...v, imageUrl } : v)),
          }
        })
        setScenes((prev) =>
          variantKey === 'base' ? prev.map((s) => (s.id === currentScene.id ? { ...s, imageUrl } : s)) : prev,
        )
      } catch {
        setError('update-failed')
      }
    },
    [currentScene],
  )

  const goToScene = useCallback(async (sceneId: string) => {
    setError(null)
    try {
      const scene = await fetchScene(sceneId)
      setCurrentScene(scene)
    } catch {
      setError('load-failed')
    }
  }, [])

  const updateLinkPosition = useCallback((linkId: string, positionX: number, positionY: number) => {
    setCurrentScene((prev) => {
      if (!prev || !prev.links) return prev
      return { ...prev, links: prev.links.map((l) => (l.id === linkId ? { ...l, positionX, positionY } : l)) }
    })

    fetch(`/api/scene-links/${linkId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionX, positionY }),
    }).catch(() => {})
  }, [])

  return {
    scenes,
    currentScene,
    isLoading,
    error,
    createFirstScene,
    createLink,
    createVariant,
    saveStory,
    changeOptionImage,
    goToScene,
    updateLinkPosition,
  }
}

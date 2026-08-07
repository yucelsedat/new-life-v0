import { useCallback, useEffect, useState } from 'react'
import { viewKey } from '../types/world'
import type { AngleDirection, SceneAngle, SceneLink, SceneVariant, StoryFrame, WorldScene } from '../types/world'

export interface UseWorldEditorResult {
  scenes: WorldScene[]
  currentScene: WorldScene | null
  isLoading: boolean
  error: string | null
  createFirstScene: (name: string, imageUrl: string) => Promise<void>
  createLink: (label: string, imageUrl: string, positionX?: number, positionY?: number) => Promise<void>
  createVariant: (imageUrl: string) => Promise<void>
  createAngle: (
    optionKey: string,
    fromOffset: number,
    direction: AngleDirection,
    imageUrl: string,
  ) => Promise<void>
  deleteAngle: (optionKey: string, angleId: string) => Promise<void>
  saveStory: (optionKey: string, angleOffset: number, imageUrls: string[]) => Promise<void>
  changeViewImage: (optionKey: string, angleOffset: number, imageUrl: string) => Promise<void>
  goToScene: (sceneId: string) => Promise<void>
  updateLinkPosition: (
    linkId: string,
    optionKey: string,
    angleOffset: number,
    positionX: number,
    positionY: number,
  ) => void
}

/** The server speaks variant ids and treats null as the scene's own image. */
function toVariantId(optionKey: string): string | null {
  return optionKey === 'base' ? null : optionKey
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

  /** Turn from the angle on screen and hang a new one off it. */
  const createAngle = useCallback(
    async (optionKey: string, fromOffset: number, direction: AngleDirection, imageUrl: string) => {
      if (!currentScene) return
      setError(null)
      try {
        const response = await fetch(`/api/scenes/${currentScene.id}/angles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variantId: toVariantId(optionKey), fromOffset, direction, imageUrl }),
        })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        const angle = (await response.json()) as SceneAngle
        setCurrentScene((prev) => {
          if (!prev) return prev
          const existing = prev.angles?.[optionKey] ?? []
          const next = [...existing, angle].sort((a, b) => a.offset - b.offset)
          return { ...prev, angles: { ...(prev.angles ?? {}), [optionKey]: next } }
        })
      } catch {
        setError('create-failed')
      }
    },
    [currentScene],
  )

  /** Removing an angle also removes everything further out on that side. */
  const deleteAngle = useCallback(
    async (optionKey: string, angleId: string) => {
      if (!currentScene) return
      setError(null)
      try {
        const response = await fetch(`/api/scenes/${currentScene.id}/angles/${angleId}`, { method: 'DELETE' })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        const { removedOffsets } = (await response.json()) as { removedOffsets: number[] }
        const removed = new Set(removedOffsets)
        setCurrentScene((prev) => {
          if (!prev) return prev
          const stories = { ...(prev.stories ?? {}) }
          for (const offset of removed) delete stories[viewKey(optionKey, offset)]
          return {
            ...prev,
            angles: {
              ...(prev.angles ?? {}),
              [optionKey]: (prev.angles?.[optionKey] ?? []).filter((angle) => !removed.has(angle.offset)),
            },
            stories,
          }
        })
      } catch {
        setError('delete-failed')
      }
    },
    [currentScene],
  )

  const saveStory = useCallback(
    async (optionKey: string, angleOffset: number, imageUrls: string[]) => {
      if (!currentScene) return
      setError(null)
      try {
        const response = await fetch(`/api/scenes/${currentScene.id}/story`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variantId: toVariantId(optionKey), angleOffset, imageUrls }),
        })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        const { frames } = (await response.json()) as { viewKey: string; frames: StoryFrame[] }
        setCurrentScene((prev) =>
          prev
            ? { ...prev, stories: { ...(prev.stories ?? {}), [viewKey(optionKey, angleOffset)]: frames } }
            : prev,
        )
      } catch {
        setError('create-failed')
      }
    },
    [currentScene],
  )

  /** Swap the image behind whatever is on screen — an option image, or one of its angles. */
  const changeViewImage = useCallback(
    async (optionKey: string, angleOffset: number, imageUrl: string) => {
      if (!currentScene) return
      setError(null)

      const angle =
        angleOffset === 0
          ? null
          : (currentScene.angles?.[optionKey] ?? []).find((item) => item.offset === angleOffset)
      if (angleOffset !== 0 && !angle) return

      const url = angle
        ? `/api/scenes/${currentScene.id}/angles/${angle.id}/image`
        : optionKey === 'base'
          ? `/api/scenes/${currentScene.id}/image`
          : `/api/scenes/${currentScene.id}/variants/${optionKey}/image`

      try {
        const response = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl }),
        })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        setCurrentScene((prev) => {
          if (!prev) return prev
          if (angle) {
            return {
              ...prev,
              angles: {
                ...(prev.angles ?? {}),
                [optionKey]: (prev.angles?.[optionKey] ?? []).map((item) =>
                  item.id === angle.id ? { ...item, imageUrl } : item,
                ),
              },
            }
          }
          if (optionKey === 'base') return { ...prev, imageUrl }
          return {
            ...prev,
            variants: (prev.variants ?? []).map((v) => (v.id === optionKey ? { ...v, imageUrl } : v)),
          }
        })
        setScenes((prev) =>
          !angle && optionKey === 'base'
            ? prev.map((s) => (s.id === currentScene.id ? { ...s, imageUrl } : s))
            : prev,
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

  /**
   * A pin dragged on the base option's own image moves the link everywhere it has no
   * placement of its own; dragged on any other angle it only moves there.
   */
  const updateLinkPosition = useCallback(
    (linkId: string, optionKey: string, angleOffset: number, positionX: number, positionY: number) => {
      const isFallbackView = optionKey === 'base' && angleOffset === 0

      setCurrentScene((prev) => {
        if (!prev || !prev.links) return prev
        return {
          ...prev,
          links: prev.links.map((link) => {
            if (link.id !== linkId) return link
            if (isFallbackView) return { ...link, positionX, positionY }
            return {
              ...link,
              anglePositions: {
                ...(link.anglePositions ?? {}),
                [viewKey(optionKey, angleOffset)]: { positionX, positionY },
              },
            }
          }),
        }
      })

      fetch(`/api/scene-links/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionX,
          positionY,
          variantId: toVariantId(optionKey),
          angleOffset,
        }),
      }).catch(() => {})
    },
    [],
  )

  return {
    scenes,
    currentScene,
    isLoading,
    error,
    createFirstScene,
    createLink,
    createVariant,
    createAngle,
    deleteAngle,
    saveStory,
    changeViewImage,
    goToScene,
    updateLinkPosition,
  }
}

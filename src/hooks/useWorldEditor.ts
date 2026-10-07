import { useCallback, useEffect, useState } from 'react'
import { viewKey } from '../types/world'
import type { SceneAngle, SceneLink, SceneVariant, StoryFrame, WorldScene } from '../types/world'

export interface UseWorldEditorResult {
  scenes: WorldScene[]
  currentScene: WorldScene | null
  isLoading: boolean
  error: string | null
  createFirstScene: (name: string, imageUrl: string, heading: number, magnetic: boolean) => Promise<void>
  createLink: (
    label: string,
    imageUrl: string,
    angleOffset: number,
    heading: number,
    magnetic: boolean,
  ) => Promise<void>
  createVariant: (imageUrl: string) => Promise<void>
  createAngle: (
    optionKey: string,
    imageUrl: string,
    heading: number,
    magnetic: boolean,
  ) => Promise<SceneAngle | null>
  /** Make the view on screen — an option image or one of its angles — magnetic, or plain again. */
  setViewMagnetic: (optionKey: string, angleOffset: number, magnetic: boolean) => void
  deleteAngle: (optionKey: string, angleId: string) => Promise<void>
  saveStory: (optionKey: string, angleOffset: number, imageUrls: string[]) => Promise<void>
  changeViewImage: (optionKey: string, angleOffset: number, imageUrl: string) => Promise<void>
  goToScene: (sceneId: string) => Promise<void>
  moveLinkToAngle: (linkId: string, angleOffset: number) => Promise<void>
  /**
   * Remove one link of the scene on screen. A link back from where it led is another link
   * and stays. Resolves to whether it went through.
   */
  deleteLink: (linkId: string) => Promise<boolean>
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

/** `openSceneId` is the scene to start on, when it is one of the world's; otherwise the first. */
export function useWorldEditor(worldId: string, openSceneId?: string | null): UseWorldEditorResult {
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
          const opening = list.find((scene) => scene.id === openSceneId) ?? list[0]
          setCurrentScene(await fetchScene(opening.id))
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
  }, [worldId, openSceneId])

  const createFirstScene = useCallback(
    async (name: string, imageUrl: string, heading: number, magnetic: boolean) => {
      setError(null)
      try {
        const response = await fetch('/api/scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worldId, name, imageUrl, heading, magnetic }),
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

  /**
   * A new scene reached from the view on screen — `angleOffset` is the angle it hangs
   * off; `heading` and `magnetic` describe the new scene's own image.
   */
  const createLink = useCallback(
    async (label: string, imageUrl: string, angleOffset: number, heading: number, magnetic: boolean) => {
      if (!currentScene) return
      setError(null)
      try {
        const response = await fetch(`/api/scenes/${currentScene.id}/links`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label, imageUrl, angleOffset, heading, magnetic }),
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

  /** Add an angle to an option, looking towards `heading`. Resolves to it, or null if it was refused. */
  const createAngle = useCallback(
    async (optionKey: string, imageUrl: string, heading: number, magnetic: boolean) => {
      if (!currentScene) return null
      setError(null)
      try {
        const response = await fetch(`/api/scenes/${currentScene.id}/angles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variantId: toVariantId(optionKey), imageUrl, heading, magnetic }),
        })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        const angle = (await response.json()) as SceneAngle
        setCurrentScene((prev) => {
          if (!prev) return prev
          const existing = prev.angles?.[optionKey] ?? []
          const next = [...existing, angle].sort((a, b) => a.offset - b.offset)
          return { ...prev, angles: { ...(prev.angles ?? {}), [optionKey]: next } }
        })
        return angle
      } catch {
        setError('create-failed')
        return null
      }
    },
    [currentScene],
  )

  /** Removing an angle takes its story and link placements with it; the other angles stay. */
  const deleteAngle = useCallback(
    async (optionKey: string, angleId: string) => {
      if (!currentScene) return
      setError(null)
      try {
        const response = await fetch(`/api/scenes/${currentScene.id}/angles/${angleId}`, { method: 'DELETE' })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        // Links whose angle is gone everywhere fall back to the option image, so the
        // server hands back the scene's links as they now stand.
        const { removedOffsets, links } = (await response.json()) as {
          removedOffsets: number[]
          links: SceneLink[]
        }
        const removed = new Set(removedOffsets)
        setCurrentScene((prev) => {
          if (!prev) return prev
          const stories = { ...(prev.stories ?? {}) }
          for (const offset of removed) delete stories[viewKey(optionKey, offset)]
          return {
            ...prev,
            links,
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

  const setViewMagnetic = useCallback(
    (optionKey: string, angleOffset: number, magnetic: boolean) => {
      if (!currentScene) return

      const angle =
        angleOffset === 0
          ? null
          : (currentScene.angles?.[optionKey] ?? []).find((item) => item.offset === angleOffset)
      if (angleOffset !== 0 && !angle) return

      setCurrentScene((prev) => {
        if (!prev) return prev
        // The option image is the scene's own view, shared by every option.
        if (!angle) return { ...prev, magnetic }
        return {
          ...prev,
          angles: {
            ...(prev.angles ?? {}),
            [optionKey]: (prev.angles?.[optionKey] ?? []).map((item) =>
              item.id === angle.id ? { ...item, magnetic } : item,
            ),
          },
        }
      })

      const url = angle
        ? `/api/scenes/${currentScene.id}/angles/${angle.id}/magnetic`
        : `/api/scenes/${currentScene.id}/magnetic`
      fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ magnetic }),
      }).catch(() => {})
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

  /** Hang a link on another view of the same scene. The server refuses a view that is taken. */
  const moveLinkToAngle = useCallback(async (linkId: string, angleOffset: number) => {
    setError(null)
    try {
      const response = await fetch(`/api/scene-links/${linkId}/angle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ angleOffset }),
      })
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      const moved = (await response.json()) as SceneLink
      setCurrentScene((prev) =>
        prev
          ? { ...prev, links: (prev.links ?? []).map((link) => (link.id === linkId ? { ...link, ...moved } : link)) }
          : prev,
      )
    } catch {
      setError('update-failed')
    }
  }, [])

  const deleteLink = useCallback(async (linkId: string) => {
    setError(null)
    try {
      const response = await fetch(`/api/scene-links/${linkId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      setCurrentScene((prev) =>
        prev ? { ...prev, links: (prev.links ?? []).filter((link) => link.id !== linkId) } : prev,
      )
      return true
    } catch {
      setError('delete-failed')
      return false
    }
  }, [])

  /**
   * A pin dragged on the base option at the link's own angle moves the link everywhere it
   * has no placement of its own; dragged in any other option it only moves there.
   */
  const updateLinkPosition = useCallback(
    (linkId: string, optionKey: string, angleOffset: number, positionX: number, positionY: number) => {
      setCurrentScene((prev) => {
        if (!prev || !prev.links) return prev
        return {
          ...prev,
          links: prev.links.map((link) => {
            if (link.id !== linkId) return link
            if (optionKey === 'base' && angleOffset === link.angleOffset) {
              // Mirrors the server: a stale placement for this view would shadow the move.
              const { [viewKey(optionKey, angleOffset)]: _stale, ...anglePositions } = link.anglePositions ?? {}
              return { ...link, positionX, positionY, anglePositions }
            }
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
    setViewMagnetic,
    saveStory,
    changeViewImage,
    goToScene,
    moveLinkToAngle,
    deleteLink,
    updateLinkPosition,
  }
}

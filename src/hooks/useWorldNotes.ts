import { useCallback, useEffect, useState } from 'react'
import type { WorldNote } from '../types/world'

export interface UseWorldNotesResult {
  notes: WorldNote[]
  isLoading: boolean
  error: string | null
  createNote: (input: { title: string; body: string }) => Promise<boolean>
  updateNote: (id: string, patch: { title?: string; body?: string; done?: boolean }) => Promise<boolean>
  deleteNote: (id: string) => Promise<boolean>
  moveNote: (id: string, direction: -1 | 1) => Promise<boolean>
}

/** Every CRUD call reports success as a boolean; the failure detail lands in `error`. */
export function useWorldNotes(worldId: string | undefined): UseWorldNotesResult {
  const [notes, setNotes] = useState<WorldNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNotes = useCallback(async () => {
    if (!worldId) return
    try {
      const response = await fetch(`/api/notes?worldId=${encodeURIComponent(worldId)}`)
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      setNotes((await response.json()) as WorldNote[])
      setError(null)
    } catch {
      setNotes([])
      setError('load')
    } finally {
      setIsLoading(false)
    }
  }, [worldId])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const createNote = useCallback(
    async ({ title, body }: { title: string; body: string }) => {
      if (!worldId) return false
      try {
        const response = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worldId, title, body }),
        })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        await fetchNotes()
        setError(null)
        return true
      } catch {
        setError('save')
        return false
      }
    },
    [worldId, fetchNotes],
  )

  const updateNote = useCallback(
    async (id: string, patch: { title?: string; body?: string; done?: boolean }) => {
      try {
        const response = await fetch(`/api/notes/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        await fetchNotes()
        setError(null)
        return true
      } catch {
        setError('save')
        return false
      }
    },
    [fetchNotes],
  )

  const deleteNote = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/notes/${id}`, { method: 'DELETE' })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        await fetchNotes()
        setError(null)
        return true
      } catch {
        setError('delete')
        return false
      }
    },
    [fetchNotes],
  )

  // Reordering only ever moves a note within its own done/open group, since that is
  // how the list is rendered — the server stores one position sequence per world.
  const moveNote = useCallback(
    async (id: string, direction: -1 | 1) => {
      if (!worldId) return false

      const note = notes.find((item) => item.id === id)
      if (!note) return false

      const group = notes.filter((item) => item.done === note.done)
      const index = group.findIndex((item) => item.id === id)
      const target = index + direction
      if (target < 0 || target >= group.length) return false

      const reordered = [...group]
      ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
      const others = notes.filter((item) => item.done !== note.done)
      const ids = (note.done ? [...others, ...reordered] : [...reordered, ...others]).map((item) => item.id)

      try {
        const response = await fetch('/api/notes/reorder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worldId, ids }),
        })
        if (!response.ok) throw new Error(`Request failed: ${response.status}`)
        setNotes((await response.json()) as WorldNote[])
        setError(null)
        return true
      } catch {
        setError('save')
        return false
      }
    },
    [worldId, notes],
  )

  return { notes, isLoading, error, createNote, updateNote, deleteNote, moveNote }
}

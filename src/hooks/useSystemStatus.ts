import { useEffect, useState } from 'react'
import type { SystemStatus } from '../types/world'

const POLL_INTERVAL_MS = 15_000

export function useSystemStatus(): SystemStatus {
  const [status, setStatus] = useState<SystemStatus>({
    sqliteConnected: false,
    aiConnected: false,
    latencyMs: null,
  })

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const [healthRes, aiRes] = await Promise.all([fetch('/api/health'), fetch('/api/ai/status')])
        const health = (await healthRes.json()) as { sqliteConnected: boolean; latencyMs: number | null }
        const ai = (await aiRes.json()) as { aiConnected: boolean }
        if (!cancelled) {
          setStatus({ sqliteConnected: health.sqliteConnected, aiConnected: ai.aiConnected, latencyMs: health.latencyMs })
        }
      } catch {
        if (!cancelled) setStatus({ sqliteConnected: false, aiConnected: false, latencyMs: null })
      }
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return status
}

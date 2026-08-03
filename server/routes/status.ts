import { Router } from 'express'
import { db } from '../db.ts'

export const statusRouter = Router()

statusRouter.get('/health', (_req, res) => {
  const start = performance.now()
  try {
    db.prepare('SELECT 1').get()
    res.json({ sqliteConnected: true, latencyMs: Math.round(performance.now() - start) })
  } catch {
    res.status(503).json({ sqliteConnected: false, latencyMs: null })
  }
})

statusRouter.get('/ai/status', (_req, res) => {
  res.json({ aiConnected: true })
})

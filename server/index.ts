import express from 'express'
import cors from 'cors'
import './seed.ts'
import { worldsRouter } from './routes/worlds.ts'
import { profileRouter } from './routes/profile.ts'
import { statusRouter } from './routes/status.ts'
import { galleryRouter, uploadsDir } from './routes/gallery.ts'
import { scenesRouter, sceneLinksRouter } from './routes/scenes.ts'
import { notesRouter } from './routes/notes.ts'

const app = express()
const PORT = process.env.PORT ?? 8787

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(uploadsDir))

app.use('/api/worlds', worldsRouter)
app.use('/api/profile', profileRouter)
app.use('/api/gallery', galleryRouter)
app.use('/api/scenes', scenesRouter)
app.use('/api/scene-links', sceneLinksRouter)
app.use('/api/notes', notesRouter)
app.use('/api', statusRouter)

app.listen(PORT, () => {
  console.log(`[new-life-api] listening on http://localhost:${PORT}`)
})

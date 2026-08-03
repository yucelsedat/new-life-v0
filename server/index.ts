import express from 'express'
import cors from 'cors'
import './seed.ts'
import { worldsRouter } from './routes/worlds.ts'
import { profileRouter } from './routes/profile.ts'
import { statusRouter } from './routes/status.ts'

const app = express()
const PORT = process.env.PORT ?? 8787

app.use(cors())
app.use(express.json())

app.use('/api/worlds', worldsRouter)
app.use('/api/profile', profileRouter)
app.use('/api', statusRouter)

app.listen(PORT, () => {
  console.log(`[new-life-api] listening on http://localhost:${PORT}`)
})

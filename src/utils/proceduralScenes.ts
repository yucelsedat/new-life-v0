import type { SceneId } from '../types/world'
import { SCENE_PALETTES } from './constants'

const TEXTURE_SIZE = 512
const cache = new Map<SceneId, HTMLCanvasElement>()

function mulberry32(seed: number) {
  return function random() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFromId(sceneId: SceneId): number {
  let hash = 0
  for (let i = 0; i < sceneId.length; i += 1) {
    hash = (hash * 31 + sceneId.charCodeAt(i)) | 0
  }
  return hash
}

function paintScene(ctx: CanvasRenderingContext2D, sceneId: SceneId): void {
  const { base, accent, glow } = SCENE_PALETTES[sceneId]
  const random = mulberry32(seedFromId(sceneId))
  const size = TEXTURE_SIZE

  const atmosphere = ctx.createLinearGradient(0, 0, 0, size)
  atmosphere.addColorStop(0, base)
  atmosphere.addColorStop(0.55, base)
  atmosphere.addColorStop(1, '#000000')
  ctx.fillStyle = atmosphere
  ctx.fillRect(0, 0, size, size)

  const beamX = size * (0.3 + random() * 0.4)
  const beam = ctx.createRadialGradient(beamX, size * 0.18, 8, beamX, size * 0.18, size * 0.55)
  beam.addColorStop(0, `${glow}55`)
  beam.addColorStop(1, `${glow}00`)
  ctx.fillStyle = beam
  ctx.fillRect(0, 0, size, size)

  ctx.fillStyle = `${accent}33`
  const blockCount = 4 + Math.floor(random() * 3)
  for (let i = 0; i < blockCount; i += 1) {
    const w = size * (0.12 + random() * 0.22)
    const h = size * (0.14 + random() * 0.3)
    const x = random() * (size - w)
    const y = size * 0.55 + random() * (size * 0.35 - h)
    ctx.fillRect(x, y, w, h)
  }

  const floor = ctx.createLinearGradient(0, size * 0.72, 0, size)
  floor.addColorStop(0, `${accent}22`)
  floor.addColorStop(1, `${base}00`)
  ctx.fillStyle = floor
  ctx.fillRect(0, size * 0.72, size, size * 0.28)

  for (let i = 0; i < 14; i += 1) {
    const r = 1 + random() * 2.5
    const x = random() * size
    const y = random() * size * 0.7
    const dot = ctx.createRadialGradient(x, y, 0, x, y, r * 4)
    dot.addColorStop(0, `${glow}aa`)
    dot.addColorStop(1, `${glow}00`)
    ctx.fillStyle = dot
    ctx.beginPath()
    ctx.arc(x, y, r * 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function getProceduralSceneCanvas(sceneId: SceneId): HTMLCanvasElement {
  const cached = cache.get(sceneId)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D context unavailable for procedural scene texture')

  paintScene(ctx, sceneId)

  cache.set(sceneId, canvas)
  return canvas
}

export function getProceduralSceneDataUrl(sceneId: SceneId): string {
  return getProceduralSceneCanvas(sceneId).toDataURL('image/png')
}

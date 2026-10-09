import type { WorldScene } from '../types/world'
import { headingVector } from './heading'

/** Radius of a scene's angle ring, in canvas units. */
export const RING_R = 68
/**
 * How far from its origin's centre a newly linked scene's ring is put, in canvas units:
 * one ring's width of clear space between the two rims.
 */
const LINK_REACH = RING_R * 4
/** The least distance kept between that ring's centre and any other's. */
const RING_CLEARANCE = RING_R * 2 + 24

export interface Vec2 {
  x: number
  y: number
}

function fallbackPosition(index: number): Vec2 {
  const col = index % 4
  const row = Math.floor(index / 4)
  return { x: 140 + col * 260, y: 140 + row * 220 }
}

/**
 * Where a scene's ring sits on the canvas. `index` is its place among the world's scenes,
 * oldest first: one that was never put anywhere takes its turn on a grid.
 */
export function canvasPosition(scene: WorldScene, index: number): Vec2 {
  const fallback = fallbackPosition(index)
  return { x: scene.canvasX ?? fallback.x, y: scene.canvasY ?? fallback.y }
}

/**
 * Where the ring of a scene newly linked from the one at `origin` goes: out along
 * `heading`, the way the new scene's own image looks, so the canvas reads the way the
 * scenes lie — and further out still while one of the `rings` is already there.
 */
export function spotBeyond(origin: Vec2, heading: number, rings: Vec2[]): Vec2 {
  const { x, y } = headingVector(heading)
  let spot = { x: origin.x + x * LINK_REACH, y: origin.y + y * LINK_REACH }
  while (rings.some((ring) => Math.hypot(ring.x - spot.x, ring.y - spot.y) < RING_CLEARANCE)) {
    spot = { x: spot.x + x * RING_CLEARANCE, y: spot.y + y * RING_CLEARANCE }
  }
  return spot
}

import type { AngleDirection, SceneAngle } from '../types/world'

/** Hands snap to the hours of a clock face. */
export const HEADING_STEP = 30

/** The nearest hour mark to any number of degrees, as a heading from 0 up to 360. */
export function snapHeading(degrees: number): number {
  const snapped = Math.round(degrees / HEADING_STEP) * HEADING_STEP
  return ((snapped % 360) + 360) % 360
}

/** The hour a hand points at: 0° is 12, 90° is 3. */
export function headingHour(heading: number): number {
  const hour = Math.round(heading / 30) % 12
  return hour === 0 ? 12 : hour
}

/** A hand's direction as a unit vector in screen space, where y grows downwards. */
export function headingVector(heading: number): { x: number; y: number } {
  const radians = (heading * Math.PI) / 180
  return { x: Math.sin(radians), y: -Math.cos(radians) }
}

/** The heading of the hand that points at something `dx`, `dy` away from the ring's centre. */
export function headingTowards(dx: number, dy: number): number {
  return snapHeading((Math.atan2(dx, -dy) * 180) / Math.PI)
}

/** One hand of an angle ring. Offset 0 is the option image itself. */
export interface RingHand {
  offset: number
  heading: number
  /** False when the heading is only a guess, for an angle that has none stored. */
  isSet: boolean
  magnetic: boolean
}

/**
 * The hands of one option: its own image and each of its angles. An angle from before
 * headings existed has no direction on record, so it gets a guess — the option's views
 * spread evenly round the circle in turning order, the way they come round when turning
 * on the spot — moved on to the next free hour if a real hand already holds that mark.
 */
export function ringHands(sceneHeading: number, angles: SceneAngle[], sceneMagnetic = false): RingHand[] {
  const taken = new Set([sceneHeading, ...angles.flatMap((angle) => (angle.heading === null ? [] : [angle.heading]))])
  const slice = 360 / (angles.length + 1)

  const hands: RingHand[] = [{ offset: 0, heading: sceneHeading, isSet: true, magnetic: sceneMagnetic }]
  for (const angle of angles) {
    if (angle.heading !== null) {
      hands.push({ offset: angle.offset, heading: angle.heading, isSet: true, magnetic: angle.magnetic })
      continue
    }
    let guess = snapHeading(sceneHeading + angle.offset * slice)
    for (let tries = 0; taken.has(guess) && tries < 360 / HEADING_STEP; tries++) {
      guess = (guess + HEADING_STEP) % 360
    }
    taken.add(guess)
    hands.push({ offset: angle.offset, heading: guess, isSet: false, magnetic: angle.magnetic })
  }
  return hands
}

/**
 * The view one turn away from the one at `offset`: the next hand round the option's
 * ring, clockwise when turning right. The ring is a full circle, so turning past the
 * last hand comes back round to the first — the way someone turning on the spot ends up
 * facing where they started. Null when the option has no angles to turn to.
 */
export function turnAngle(
  offset: number,
  sceneHeading: number,
  angles: SceneAngle[],
  direction: AngleDirection,
): number | null {
  if (angles.length === 0) return null
  const hands = ringHands(sceneHeading, angles).sort((a, b) => a.heading - b.heading)
  const index = hands.findIndex((hand) => hand.offset === offset)
  // A view that is no longer on the ring has no neighbours; the option image always is.
  if (index < 0) return 0
  const step = direction === 'right' ? 1 : -1
  return hands[(index + step + hands.length) % hands.length].offset
}

/**
 * The view someone lands on when a link brings them to a location while facing `heading`.
 *
 * A magnetic view pulls them in: with any on the ring, they land on the magnetic one
 * nearest the way they were facing — ahead even of a plain view facing exactly that way.
 * With none, they keep facing the same way if a view does; otherwise they land on the
 * option image, the location's main view. A hand whose heading is only a guess takes no
 * part, and nor does a traveller whose own heading is unknown (`null`).
 */
export function arrivalOffset(heading: number | null, hands: RingHand[]): number {
  if (heading === null) return 0
  const known = hands.filter((hand) => hand.isSet)

  const magnets = known.filter((hand) => hand.magnetic)
  if (magnets.length > 0) {
    const clockwise = (hand: RingHand) => (((hand.heading - heading) % 360) + 360) % 360
    const away = (hand: RingHand) => Math.min(clockwise(hand), 360 - clockwise(hand))
    // Two magnets equally far apart: the one to the right wins.
    return [...magnets].sort((a, b) => away(a) - away(b) || clockwise(a) - clockwise(b))[0].offset
  }

  return known.find((hand) => hand.heading === heading)?.offset ?? 0
}

/**
 * The view the editor opens a location on when it is picked on the canvas. A location
 * with magnetic views opens on one of them — the one nearest the view picked on its
 * ring, as if walking in facing that way. With none it opens on the picked view itself.
 */
export function openingOffset(offset: number, hands: RingHand[]): number {
  if (!hands.some((hand) => hand.isSet && hand.magnetic)) return offset
  const picked = hands.find((hand) => hand.offset === offset)
  // A picked view with no heading on record is read as facing the way the option image does.
  const facing = picked?.isSet ? picked.heading : (hands.find((hand) => hand.offset === 0)?.heading ?? 0)
  return arrivalOffset(facing, hands)
}

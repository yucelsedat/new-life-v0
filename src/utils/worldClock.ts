import type { WorldOptionTime } from '../types/world'

/**
 * A world runs on its own clock. Scene options are not alternatives to choose between —
 * they are the same place later in the day, so which one is on screen is decided by the
 * time, and every scene turns over together.
 */

/** Where a world's clock starts when option 0 has never been given a time. */
export const WORLD_START_MINUTE = 12 * 60

/** One world-minute per real second — a day passes in twenty-four minutes. */
export const WORLD_MINUTE_MS = 1000

export const MINUTES_PER_DAY = 24 * 60

export function formatClock(minuteOfDay: number): string {
  const wrapped = ((minuteOfDay % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const hours = Math.floor(wrapped / 60)
  const minutes = wrapped % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/**
 * Reads a typed time back into minutes since midnight. Turkish writes the hour with a
 * dot as readily as a colon, and a time typed straight off the number row has no
 * separator at all, so '12:30', '12.30' and '1230' all mean half past twelve.
 * Returns null for anything that is not a time.
 */
export function parseClock(value: string): number | null {
  const trimmed = value.trim()
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(trimmed) ?? /^(\d{1,2})(\d{2})$/.exec(trimmed)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/** The minute option 0 sits at — the moment the world opens on. */
export function startMinute(times: WorldOptionTime[]): number {
  return times.find((time) => time.optionIndex === 0)?.minuteOfDay ?? WORLD_START_MINUTE
}

export function minuteOfDayFor(times: WorldOptionTime[], elapsedMinutes: number): number {
  return (startMinute(times) + elapsedMinutes) % MINUTES_PER_DAY
}

/**
 * Which option index the world has reached after `elapsedMinutes` of play. Options come
 * into force in index order, so the walk stops at the first one whose minute has not
 * arrived yet — a later option timed earlier in the day than the one before it never
 * jumps the queue.
 */
export function activeOptionIndex(times: WorldOptionTime[], elapsedMinutes: number): number {
  const start = startMinute(times)
  const chain = [...times].sort((a, b) => a.optionIndex - b.optionIndex)

  let active = 0
  let previousThreshold = 0

  for (const time of chain) {
    if (time.optionIndex === 0) continue
    // Times are wall-clock, so an option set before the opening minute belongs to the
    // following day rather than to a moment already gone.
    const threshold = (time.minuteOfDay - start + MINUTES_PER_DAY) % MINUTES_PER_DAY
    if (threshold <= previousThreshold || threshold > elapsedMinutes) break
    active = time.optionIndex
    previousThreshold = threshold
  }

  return active
}

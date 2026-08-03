export function formatProgress(progress: number): string {
  return `%${Math.round(progress * 100)}`
}

export function formatPlayTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins} dk`
  return `${hours} sa ${mins} dk`
}

const relativeFormatter = new Intl.RelativeTimeFormat('tr', { numeric: 'auto' })

export function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate)
  const diffMs = date.getTime() - Date.now()
  const diffMinutes = Math.round(diffMs / 60000)

  if (Math.abs(diffMinutes) < 60) return relativeFormatter.format(diffMinutes, 'minute')
  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) return relativeFormatter.format(diffHours, 'hour')
  const diffDays = Math.round(diffHours / 24)
  return relativeFormatter.format(diffDays, 'day')
}

export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(new Date(isoDate))
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

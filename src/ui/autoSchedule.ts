// "Plan my day" (Akiflow-style): pack candidates into today's free slots.
// Best-effort heuristic, documented limits: working window 09:00–18:00 local
// (starting no earlier than "now" for today), 15-minute snap, 15-minute
// breathing gap between placed blocks, first-fit in candidate order, no
// splitting, candidates that don't fit are left unplaced.

import type { CalendarEvent } from '../types'
import { minutesOfDay, parseLocalDateTime, sameDay, toDateKey } from './dates'

const DAY_START_MIN = 9 * 60
const DAY_END_MIN = 18 * 60
const GAP_MINUTES = 15

export type PlanCandidate = {
  key: string
  durationMinutes: number
}

export type PlanPlacement = {
  key: string
  /** `YYYY-MM-DDTHH:mm` start on the planned day. */
  start: string
}

export function planDay(
  day: Date,
  existingEvents: CalendarEvent[],
  candidates: PlanCandidate[],
  now: Date
): PlanPlacement[] {
  const busy = existingEvents
    .filter((event) => !event.allDay && !event.unscheduled && sameDay(parseLocalDateTime(event.start), day))
    .map((event) => {
      const start = minutesOfDay(event.start)
      return { start, end: start + Math.max(15, event.durationMinutes) }
    })
    .sort((a, b) => a.start - b.start)

  let cursor = DAY_START_MIN
  if (sameDay(day, now)) {
    const nowMin = now.getHours() * 60 + now.getMinutes()
    cursor = Math.max(cursor, Math.ceil(nowMin / 15) * 15)
  }

  const placements: PlanPlacement[] = []
  const dateKey = toDateKey(day)

  for (const candidate of candidates) {
    const duration = Math.max(15, candidate.durationMinutes)
    let placedAt: number | null = null
    while (cursor + duration <= DAY_END_MIN) {
      const conflict = busy.find((slot) => slot.start < cursor + duration && slot.end > cursor)
      if (!conflict) {
        placedAt = cursor
        break
      }
      cursor = Math.max(conflict.end, cursor + 15)
    }
    if (placedAt === null) continue
    const h = Math.floor(placedAt / 60)
    const m = placedAt % 60
    placements.push({
      key: candidate.key,
      start: `${dateKey}T${h < 10 ? `0${h}` : h}:${m < 10 ? `0${m}` : m}`,
    })
    busy.push({ start: placedAt, end: placedAt + duration })
    busy.sort((a, b) => a.start - b.start)
    cursor = placedAt + duration + GAP_MINUTES
  }
  return placements
}

// Recurring-event expansion for display. A repeating note/task renders an
// occurrence in every matching visible slot; the stored record stays a single
// base event (occurrences reference it — editing/moving/resizing an
// occurrence edits the series anchor). Scheduled runs are unaffected here:
// automation/sprint repeats map to daily/weekly cadences on the automation
// record itself.

import type { CalendarEvent } from '../types'
import { addDays, parseLocalDateTime, sameDay, toDateKey } from './dates'

/** A renderable occurrence: `occurrenceKey` is unique per slot, `event` keeps
 * the base identity so interactions round-trip to the stored record. */
export type DisplayEvent = {
  occurrenceKey: string
  /** Start of THIS occurrence (`YYYY-MM-DDTHH:mm`). */
  start: string
  /** True when this is a repeat projection, not the base slot. */
  isProjection: boolean
  event: CalendarEvent
}

export function expandEvents(events: CalendarEvent[], days: Date[]): DisplayEvent[] {
  const out: DisplayEvent[] = []
  for (const event of events) {
    const base = parseLocalDateTime(event.start)
    const timePart = event.start.slice(11, 16)
    for (const day of days) {
      const onBaseDay = sameDay(base, day)
      let occurs = onBaseDay
      if (!occurs && event.repeat === 'daily') {
        occurs = day.getTime() > base.getTime()
      } else if (!occurs && event.repeat === 'weekly') {
        occurs = day.getDay() === base.getDay() && day.getTime() > base.getTime()
      }
      if (!occurs) continue
      const start = onBaseDay ? event.start : `${toDateKey(day)}T${timePart}`
      out.push({
        occurrenceKey: `${event.id}@${start}`,
        start,
        isProjection: !onBaseDay,
        event,
      })
    }
  }
  return out
}

/** Days covered by a month grid (6 weeks) — reused by MonthView expansion. */
export function monthGridDays(firstCell: Date): Date[] {
  return Array.from({ length: 42 }, (_, i) => addDays(firstCell, i))
}

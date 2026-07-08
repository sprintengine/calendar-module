import { useMemo } from 'react'

import type { CalendarEvent } from '../types'
import { DAY_LABELS, addDays, parseLocalDateTime, sameDay, startOfMonth, startOfWeek, toDateKey } from './dates'

const MAX_CHIPS = 3

type MonthViewProps = {
  focusDate: Date
  events: CalendarEvent[]
  now: Date
  onOpenDay(day: Date): void
  onOpen(event: CalendarEvent): void
}

export function MonthView({ focusDate, events, now, onOpenDay, onOpen }: MonthViewProps) {
  const cells = useMemo(() => {
    const first = startOfWeek(startOfMonth(focusDate))
    return Array.from({ length: 42 }, (_, i) => addDays(first, i))
  }, [focusDate])

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const key = toDateKey(parseLocalDateTime(event.start))
      const list = map.get(key) ?? []
      list.push(event)
      map.set(key, list)
    }
    return map
  }, [events])

  return (
    <div className="mccal-month">
      <div className="mccal-month-heads">
        {DAY_LABELS.map((label) => (
          <div key={label} className="mccal-month-head">
            {label}
          </div>
        ))}
      </div>
      <div className="mccal-month-grid">
        {cells.map((day) => {
          const dayEvents = byDay.get(toDateKey(day)) ?? []
          const outside = day.getMonth() !== focusDate.getMonth()
          return (
            <div
              key={toDateKey(day)}
              className={[
                'mccal-mcell',
                outside ? 'mccal-outside' : '',
                sameDay(day, now) ? 'mccal-today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              role="button"
              tabIndex={0}
              aria-label={day.toDateString()}
              onClick={() => onOpenDay(day)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onOpenDay(day)
              }}
            >
              <span className="mccal-mnum">{day.getDate()}</span>
              {dayEvents.slice(0, MAX_CHIPS).map((event) => (
                <span
                  key={event.id}
                  className={`mccal-mchip mccal-${event.kind}`}
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation()
                    onOpen(event)
                  }}
                >
                  {event.title}
                </span>
              ))}
              {dayEvents.length > MAX_CHIPS ? (
                <span className="mccal-mmore">+{dayEvents.length - MAX_CHIPS} more</span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

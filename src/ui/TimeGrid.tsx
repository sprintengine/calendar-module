// The Outlook-style time grid shared by week and day views: fixed time
// gutter, day columns, all-day row, now line, positioned event blocks with
// drag-create, drag-move, resize, and external drops (Backlog panel drags via
// the published file-drop contract; planning-rail drags via the module's own
// MIME).

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, DragEvent as ReactDragEvent, KeyboardEvent } from 'react'

import { hasFileDropData } from '@sprintengine/module-sdk'

import type { CalendarEvent } from '../types'
import { minutesOfDay, pad2, parseLocalDateTime, sameDay, toDateKey, toLocalDateTime } from './dates'
import { layoutDayEvents } from './layout'

export const HOUR_HEIGHT = 48
const SNAP_MINUTES = 15
const DEFAULT_SCROLL_HOUR = 7

export const CALENDAR_DROP_MIME = 'application/x-sprintengine-calendar-drop'

export type CalendarDropPayload =
  | { kind: 'rail-backlog'; path: string; title: string; displayId?: string }
  | { kind: 'rail-task'; eventId: string }

export type DropTarget = { start: string }

type TimeGridProps = {
  days: Date[]
  events: CalendarEvent[]
  now: Date
  onCreateRange(start: string, durationMinutes: number): void
  onMove(eventId: string, newStart: string): void
  onResize(eventId: string, durationMinutes: number): void
  onOpen(event: CalendarEvent): void
  onDelete?(event: CalendarEvent): void
  onExternalDrop(dataTransfer: DataTransfer, target: DropTarget): void
}

type DragState =
  | { mode: 'create'; dayIndex: number; anchorMin: number; currentMin: number }
  | { mode: 'move'; eventId: string; grabOffsetMin: number; dayIndex: number; currentMin: number; durationMinutes: number }
  | { mode: 'resize'; eventId: string; dayIndex: number; startMin: number; currentEndMin: number }

function snap(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES
}

function clampMin(minutes: number): number {
  return Math.max(0, Math.min(24 * 60 - SNAP_MINUTES, minutes))
}

function timeLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${pad2(h)}:${pad2(m)}`
}

function eventTimeLabel(event: CalendarEvent): string {
  const startMin = minutesOfDay(event.start)
  if (event.kind === 'automation' || event.kind === 'sprint') {
    return `runs at ${timeLabel(startMin)}`
  }
  return `${timeLabel(startMin)} – ${timeLabel(Math.min(24 * 60, startMin + event.durationMinutes))}`
}

export function TimeGrid({
  days,
  events,
  now,
  onCreateRange,
  onMove,
  onResize,
  onOpen,
  onDelete,
  onExternalDrop,
}: TimeGridProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [dropHoverDay, setDropHoverDay] = useState<number | null>(null)

  useEffect(() => {
    // Initial scroll to the working-hours window.
    const el = scrollRef.current
    if (el) el.scrollTop = DEFAULT_SCROLL_HOUR * HOUR_HEIGHT
  }, [])

  const eventsByDay = useMemo(() => {
    return days.map((day) => {
      const timed = events.filter(
        (event) => !event.allDay && sameDay(parseLocalDateTime(event.start), day)
      )
      return layoutDayEvents(timed)
    })
  }, [days, events])

  const allDayByDay = useMemo(
    () =>
      days.map((day) =>
        events.filter((event) => event.allDay && sameDay(parseLocalDateTime(event.start), day))
      ),
    [days, events]
  )

  const columns = `54px repeat(${days.length}, 1fr)`

  function pointToSlot(clientX: number, clientY: number): { dayIndex: number; minutes: number } | null {
    const grid = gridRef.current
    if (!grid) return null
    const rect = grid.getBoundingClientRect()
    const x = clientX - rect.left - 54
    const colWidth = (rect.width - 54) / days.length
    const dayIndex = Math.max(0, Math.min(days.length - 1, Math.floor(x / colWidth)))
    const minutes = clampMin(snap(((clientY - rect.top) / HOUR_HEIGHT) * 60))
    return { dayIndex, minutes }
  }

  function startAt(dayIndex: number, minutes: number): string {
    const day = days[dayIndex]
    const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes)
    return toLocalDateTime(d)
  }

  // ── Pointer interactions ───────────────────────────────────────────────────

  function handleColumnPointerDown(event: ReactPointerEvent, dayIndex: number) {
    if (event.button !== 0) return
    const slot = pointToSlot(event.clientX, event.clientY)
    if (!slot) return
    ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
    setDrag({ mode: 'create', dayIndex, anchorMin: slot.minutes, currentMin: slot.minutes + 30 })
  }

  function handleEventPointerDown(event: ReactPointerEvent, calEvent: CalendarEvent) {
    if (event.button !== 0) return
    event.stopPropagation()
    const slot = pointToSlot(event.clientX, event.clientY)
    if (!slot) return
    const startMin = minutesOfDay(calEvent.start)
    ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
    setDrag({
      mode: 'move',
      eventId: calEvent.id,
      grabOffsetMin: slot.minutes - startMin,
      dayIndex: slot.dayIndex,
      currentMin: startMin,
      durationMinutes: calEvent.durationMinutes,
    })
  }

  function handleResizePointerDown(event: ReactPointerEvent, calEvent: CalendarEvent, dayIndex: number) {
    if (event.button !== 0) return
    event.stopPropagation()
    const startMin = minutesOfDay(calEvent.start)
    ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
    setDrag({
      mode: 'resize',
      eventId: calEvent.id,
      dayIndex,
      startMin,
      currentEndMin: startMin + calEvent.durationMinutes,
    })
  }

  function handlePointerMove(event: ReactPointerEvent) {
    if (!drag) return
    const slot = pointToSlot(event.clientX, event.clientY)
    if (!slot) return
    if (drag.mode === 'create') {
      setDrag({ ...drag, dayIndex: slot.dayIndex, currentMin: slot.minutes })
    } else if (drag.mode === 'move') {
      setDrag({ ...drag, dayIndex: slot.dayIndex, currentMin: clampMin(slot.minutes - drag.grabOffsetMin) })
    } else {
      setDrag({ ...drag, currentEndMin: Math.max(drag.startMin + SNAP_MINUTES, slot.minutes) })
    }
  }

  function handlePointerUp() {
    if (!drag) return
    if (drag.mode === 'create') {
      const startMin = Math.min(drag.anchorMin, drag.currentMin)
      const endMin = Math.max(drag.anchorMin, drag.currentMin, startMin + SNAP_MINUTES)
      // A plain click (no drag) creates a default 30-minute slot.
      const duration = endMin - startMin < SNAP_MINUTES ? 30 : endMin - startMin
      onCreateRange(startAt(drag.dayIndex, startMin), duration)
    } else if (drag.mode === 'move') {
      onMove(drag.eventId, startAt(drag.dayIndex, drag.currentMin))
    } else {
      onResize(drag.eventId, drag.currentEndMin - drag.startMin)
    }
    setDrag(null)
  }

  // ── External drops (Backlog panel / planning rail) ─────────────────────────

  function handleDragOver(event: ReactDragEvent, dayIndex: number) {
    const types = Array.from(event.dataTransfer.types)
    if (hasFileDropData(event.dataTransfer) || types.includes(CALENDAR_DROP_MIME)) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
      setDropHoverDay(dayIndex)
    }
  }

  function handleDrop(event: ReactDragEvent) {
    event.preventDefault()
    setDropHoverDay(null)
    const slot = pointToSlot(event.clientX, event.clientY)
    if (!slot) return
    onExternalDrop(event.dataTransfer, { start: startAt(slot.dayIndex, slot.minutes) })
  }

  function handleEventKeyDown(event: KeyboardEvent, calEvent: CalendarEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen(calEvent)
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      onDelete?.(calEvent)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const totalHeight = 24 * HOUR_HEIGHT
  const nowMin = now.getHours() * 60 + now.getMinutes()

  return (
    <div className="mccal-gridwrap">
      <div className="mccal-heads" style={{ gridTemplateColumns: columns }}>
        <div className="mccal-head mccal-gutterhead">
          {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </div>
        {days.map((day, i) => (
          <div key={i} className={`mccal-head${sameDay(day, now) ? ' mccal-today' : ''}`}>
            {day.toLocaleDateString(undefined, { weekday: 'short' })}
            <span className="mccal-dom">{day.getDate()}</span>
          </div>
        ))}
      </div>

      <div className="mccal-allday-row" style={{ gridTemplateColumns: columns }}>
        <div className="mccal-allday-cell mccal-gutter-cell">all-day</div>
        {days.map((_day, i) => (
          <div key={i} className="mccal-allday-cell">
            {allDayByDay[i].map((event) => (
              <span
                key={event.id}
                className={`mccal-mchip mccal-${event.kind}`}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(event)}
                onKeyDown={(keyEvent) => handleEventKeyDown(keyEvent, event)}
              >
                {event.title}
              </span>
            ))}
          </div>
        ))}
      </div>

      <div className="mccal-scroll" ref={scrollRef}>
        <div
          className="mccal-grid"
          ref={gridRef}
          style={{ gridTemplateColumns: columns, height: totalHeight }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="mccal-gutter">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="mccal-hourlab" style={{ top: hour * HOUR_HEIGHT }}>
                {hour === 0 ? '' : timeLabel(hour * 60)}
              </div>
            ))}
          </div>

          {days.map((day, dayIndex) => {
            const isToday = sameDay(day, now)
            return (
              <div
                key={toDateKey(day)}
                className={[
                  'mccal-daycol',
                  isToday ? 'mccal-today-col' : '',
                  dropHoverDay === dayIndex ? 'mccal-drophover' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onPointerDown={(event) => handleColumnPointerDown(event, dayIndex)}
                onDragOver={(event) => handleDragOver(event, dayIndex)}
                onDragLeave={() => setDropHoverDay((current) => (current === dayIndex ? null : current))}
                onDrop={handleDrop}
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <div key={hour}>
                    <div className="mccal-hline" style={{ top: hour * HOUR_HEIGHT }} />
                    <div className="mccal-hline mccal-half" style={{ top: hour * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
                  </div>
                ))}

                {eventsByDay[dayIndex].map(({ event, startMin, endMin, lane, laneCount }) => {
                  const isDraggingThis = drag?.mode === 'move' && drag.eventId === event.id
                  const isResizingThis = drag?.mode === 'resize' && drag.eventId === event.id
                  const top = (startMin / 60) * HOUR_HEIGHT
                  const height = Math.max(18, ((endMin - startMin) / 60) * HOUR_HEIGHT - 2)
                  const width = 100 / laneCount
                  return (
                    <div
                      key={event.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${event.title}, ${event.kind}, ${eventTimeLabel(event)}`}
                      className={[
                        'mccal-ev',
                        `mccal-${event.kind}`,
                        event.source ? 'mccal-from-backlog' : '',
                        isDraggingThis || isResizingThis ? 'mccal-dragging' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={{
                        top,
                        height: isResizingThis && drag?.mode === 'resize'
                          ? Math.max(18, ((drag.currentEndMin - startMin) / 60) * HOUR_HEIGHT - 2)
                          : height,
                        left: `calc(${lane * width}% + 1px)`,
                        width: `calc(${width}% - 3px)`,
                      }}
                      onPointerDown={(pointerEvent) => handleEventPointerDown(pointerEvent, event)}
                      onKeyDown={(keyEvent) => handleEventKeyDown(keyEvent, event)}
                      onDoubleClick={() => onOpen(event)}
                      onClick={(clickEvent) => {
                        // Single click opens too, unless it ended a drag.
                        if (!drag) {
                          clickEvent.stopPropagation()
                          onOpen(event)
                        }
                      }}
                    >
                      <span className="mccal-ev-title">
                        {event.source?.displayId ? (
                          <span className="mccal-ev-src">{event.source.displayId} </span>
                        ) : null}
                        {event.title}
                      </span>
                      {((endMin - startMin) / 60) * HOUR_HEIGHT >= 34 ? (
                        <span className="mccal-ev-time">{eventTimeLabel(event)}</span>
                      ) : null}
                      {(event.kind === 'note' || event.kind === 'task') && !isDraggingThis ? (
                        <div
                          className="mccal-resize"
                          onPointerDown={(pointerEvent) => handleResizePointerDown(pointerEvent, event, dayIndex)}
                        />
                      ) : null}
                    </div>
                  )
                })}

                {drag?.mode === 'create' && drag.dayIndex === dayIndex ? (
                  <div
                    className="mccal-ghost"
                    style={{
                      top: (Math.min(drag.anchorMin, drag.currentMin) / 60) * HOUR_HEIGHT,
                      height: Math.max(
                        (SNAP_MINUTES / 60) * HOUR_HEIGHT,
                        (Math.abs(drag.currentMin - drag.anchorMin) / 60) * HOUR_HEIGHT
                      ),
                      left: 1,
                      right: 2,
                    }}
                  />
                ) : null}
                {drag?.mode === 'move' && drag.dayIndex === dayIndex ? (
                  <div
                    className="mccal-ghost"
                    style={{
                      top: (drag.currentMin / 60) * HOUR_HEIGHT,
                      height: (drag.durationMinutes / 60) * HOUR_HEIGHT,
                      left: 1,
                      right: 2,
                    }}
                  />
                ) : null}

                {isToday ? (
                  <div className="mccal-nowline" style={{ top: (nowMin / 60) * HOUR_HEIGHT }}>
                    <span className="mccal-bead" />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

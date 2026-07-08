// Shared event model between entry.renderer and entry.main. This file is the
// module's own contract — the SDK knows nothing about it; it travels over the
// module's `host.invoke` bridge channels only.

export type EventKind = 'note' | 'task' | 'automation' | 'sprint'

export type EventRepeat = 'none' | 'daily' | 'weekly'

export type CalendarEvent = {
  id: string
  title: string
  description?: string
  kind: EventKind
  /** Local wall-clock start, `YYYY-MM-DDTHH:mm` (same shape the `at` cadence takes). */
  start: string
  /** Duration in minutes. Meaningful for note/task; automation/sprint fire at start. */
  durationMinutes: number
  /** Task sitting in the planning rail, not yet placed on the grid. */
  unscheduled?: boolean
  allDay?: boolean
  repeat?: EventRepeat
  /** Set when the event was created from a Backlog item. */
  source?: {
    /** Absolute path of the backlog markdown file. */
    path: string
    /** Display id like `MC-123`, when known. */
    displayId?: string
    title?: string
  }
  /** Automation record backing this event (automation/sprint kinds, once scheduled). */
  automationId?: string
  /** Agent CLI / model selection for scheduled runs. */
  cli?: string
  cliModel?: string
  /** Connector (MCP catalog) id for connector-backed runs. */
  connectorId?: string
  createdAt: string
  updatedAt: string
}

export type EventsFile = {
  version: 1
  events: CalendarEvent[]
}

// ── Bridge channel payloads (module-internal contract) ──────────────────────

export const CH_EVENTS_LOAD = 'calendar:events-load'
export const CH_EVENTS_SAVE = 'calendar:events-save'
export const CH_SCHEDULE = 'calendar:schedule'
export const CH_UNSCHEDULE = 'calendar:unschedule'
export const CH_PING = 'calendar:ping'
export const CH_CREATE_BACKLOG_ITEM = 'calendar:create-backlog-item'

export type EventsLoadRequest = { workspaceId: string }
export type EventsLoadResponse = { events: CalendarEvent[] }

export type EventsSaveRequest = { workspaceId: string; events: CalendarEvent[] }
export type EventsSaveResponse = { saved: true }

export type ScheduleRequest = {
  workspaceRoot: string
  event: CalendarEvent
}
export type ScheduleResponse =
  | { ok: true; automationId: string }
  | { ok: false; code: string; message: string }

export type UnscheduleRequest = { workspaceRoot: string; automationId: string }
export type UnscheduleResponse = { ok: boolean; message?: string }

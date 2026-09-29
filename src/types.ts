// Shared event model between entry.renderer and entry.main. This file is the
// module's own contract — the SDK knows nothing about it; it travels over the
// module's `host.invoke` bridge channels only.

export type EventKind = 'note' | 'task' | 'automation'

/**
 * How a scheduled run's chat treats the agent CLI's permission prompts:
 * `none` passes no permission flag (the CLI's own configuration decides),
 * `bypass` skips every prompt. Scheduled runs default to `none`; `bypass` is
 * only ever the user's explicit choice in the event editor.
 */
export type RunPermissionPreset = 'none' | 'bypass'

export type EventRepeat = 'none' | 'daily' | 'weekly'

export type CalendarEvent = {
  id: string
  title: string
  description?: string
  kind: EventKind
  /** Local wall-clock start, `YYYY-MM-DDTHH:mm` (same shape the `at` cadence takes). */
  start: string
  /** Duration in minutes. Meaningful for note/task; automations fire at start. */
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
  /** Automation record backing this event (automation kind, once scheduled). */
  automationId?: string
  /** Agent CLI / model selection for scheduled runs. */
  cli?: string
  cliModel?: string
  /** Permission preset the scheduled run's chat launches with (absent = `none`). */
  permissionPreset?: RunPermissionPreset
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
export const CH_RUNS = 'calendar:runs'

/** `host.emit` topic: the calendar's run chats changed — read CH_RUNS again. */
export const TOPIC_RUNS_CHANGED = 'runs-changed'

export type EventsLoadRequest = { workspaceId: string }
export type EventsLoadResponse = { events: CalendarEvent[] }

export type EventsSaveRequest = { workspaceId: string; events: CalendarEvent[] }
export type EventsSaveResponse = { saved: true }

// Requests name the workspace by id only: entry.main resolves its folder
// through the host's workspace context and never takes a path from the
// renderer.

export type ScheduleRequest = {
  workspaceId: string
  event: CalendarEvent
}
export type ScheduleResponse =
  | { ok: true; automationId: string }
  | { ok: false; code: string; message: string }

export type UnscheduleRequest = { workspaceId: string; automationId: string }
export type UnscheduleResponse = { ok: boolean; message?: string }

export type CreateBacklogItemRequest = { workspaceId: string; title: string; description?: string }
export type CreateBacklogItemResponse = { relativePath: string; path: string }

/** One chat a scheduled calendar run started, as the panel's readout shows it. */
export type CalendarRun = {
  workspaceId: string
  agentId: string
  name: string
  status: string
}
export type RunsResponse = { available: boolean; runs: CalendarRun[] }

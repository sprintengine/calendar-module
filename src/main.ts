// entry.main — Node-side half of the calendar module. Owns event persistence,
// automation creation (the scheduling engine), the action provider that runs
// a scheduled event as a chat, and the readout of the chats those runs start.
//
// Every channel names its workspace by id. The folder a request acts on is
// resolved here through the host's workspace context, never taken from the
// renderer: a path in an IPC payload would let any renderer code aim the
// module's file writes and automations at an arbitrary directory.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  getAutomationsService,
  getConversationService,
  getModuleStorage,
  registerAutomationAction,
  WorkspaceContextToken,
  type ActionContext,
  type AutomationActionProvider,
  type MainHost,
  type ModuleConversationSummary,
  type ModuleStorageService,
  type RegisterMain,
  type ScheduleTriggerConfig,
} from '@sprintengine/module-sdk'

import {
  CH_CREATE_BACKLOG_ITEM,
  CH_EVENTS_LOAD,
  CH_EVENTS_SAVE,
  CH_PING,
  CH_RUNS,
  CH_SCHEDULE,
  CH_UNSCHEDULE,
  TOPIC_RUNS_CHANGED,
  type CalendarEvent,
  type CalendarRun,
  type CreateBacklogItemRequest,
  type CreateBacklogItemResponse,
  type EventsFile,
  type EventsLoadRequest,
  type EventsSaveRequest,
  type RunPermissionPreset,
  type RunsResponse,
  type ScheduleRequest,
  type ScheduleResponse,
  type UnscheduleRequest,
} from './types'

// ── Workspace folder resolution ──────────────────────────────────────────────

function requireWorkspaceId(value: unknown, channel: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${channel} requires a workspaceId.`)
  return value
}

/**
 * The folder of `workspaceId`, from the host's workspace context. Throws when
 * the workspace is not resolvable yet (the panel retries) or has no folder
 * (nothing to schedule into or write a backlog item to).
 */
export async function resolveWorkspaceRoot(host: MainHost, workspaceId: string): Promise<string> {
  const view = await host.requireService(WorkspaceContextToken).get(workspaceId)
  if (!view) throw new Error(`Workspace "${workspaceId}" is not resolvable yet — retry shortly.`)
  if (!view.folderPath) throw new Error(`Workspace "${workspaceId}" has no folder, so it cannot run scheduled events.`)
  return view.folderPath
}

// ── Event persistence ────────────────────────────────────────────────────────
// Events persist through the SDK's module storage (host-placed): per-workspace
// data lives inside the workspace folder (`.sprintengine/modules/calendar/`),
// resolved from workspaceId via the workspace context. A folderless (or
// not-yet-resolvable) workspace falls back to the module's global per-user
// store under a workspace-derived key, so the calendar still works there.

const EVENTS_KEY = 'events'

function globalEventsKey(workspaceId: string): string {
  const safe = workspaceId.toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/^[^a-z0-9]+/, '')
  return `events-${safe || 'workspace'}`.slice(0, 64)
}

async function eventsScope(
  host: MainHost,
  workspaceId: string
): Promise<{ key: string; workspaceRoot?: string }> {
  const view = await host.requireService(WorkspaceContextToken).get(workspaceId)
  // A null view is transient ("not resolvable yet") — fail the call so the
  // panel retries, instead of silently reading/writing the global fallback
  // and forking the store across two scopes. A RESOLVED workspace without a
  // folder is genuinely folderless and keeps its stable global key.
  if (!view) throw new Error(`Workspace "${workspaceId}" is not resolvable yet — retry shortly.`)
  return view.folderPath ? { key: EVENTS_KEY, workspaceRoot: view.folderPath } : { key: globalEventsKey(workspaceId) }
}

/**
 * Events saved before the Sprint kind was retired (the app no longer has a
 * Sprint Engine to start) read back as automations: both ran the same way, an
 * agent handed the event as its brief.
 */
function normalizeEvent(event: CalendarEvent): CalendarEvent {
  return (event.kind as string) === 'sprint' ? { ...event, kind: 'automation' } : event
}

async function loadEvents(host: MainHost, storage: ModuleStorageService, workspaceId: string): Promise<CalendarEvent[]> {
  const scope = await eventsScope(host, workspaceId)
  const record = await storage.get(scope)
  if (!record.ok || !record.found) return []
  const parsed = record.value as Partial<EventsFile>
  if (parsed.version !== 1 || !Array.isArray(parsed.events)) return []
  return parsed.events.map(normalizeEvent)
}

async function saveEvents(
  host: MainHost,
  storage: ModuleStorageService,
  workspaceId: string,
  events: CalendarEvent[]
): Promise<void> {
  const file: EventsFile = { version: 1, events }
  const scope = await eventsScope(host, workspaceId)
  const saved = await storage.set({ ...scope, value: file })
  if (!saved.ok) throw new Error(`Saving calendar events failed (${saved.code}): ${saved.message}`)
}

// ── Scheduling: calendar event → real Automation ────────────────────────────

export function cadenceFor(event: CalendarEvent): ScheduleTriggerConfig['cadence'] {
  const timeLocal = event.start.slice(11, 16)
  if (event.repeat === 'daily') return { type: 'daily', timeLocal }
  if (event.repeat === 'weekly') {
    const day = new Date(`${event.start}:00`).getDay()
    return { type: 'weekly', timeLocal, daysOfWeek: [day] }
  }
  return { type: 'at', datetime: event.start }
}

export function runPrompt(event: CalendarEvent): string {
  const lines: string[] = ['You are running a scheduled task created from a SprintEngine Calendar event.']
  lines.push(`Event: ${event.title}`)
  if (event.description) lines.push(`Details: ${event.description}`)
  if (event.source) {
    lines.push(
      `Source backlog item: ${event.source.displayId ?? ''} ${event.source.title ?? ''}`.trim()
    )
    lines.push(`Work the item at: ${event.source.path}`)
    lines.push('Read that file first and treat it as the work brief; keep its frontmatter status current.')
  }
  return lines.join('\n')
}

/** Only `bypass` itself widens a run; anything else (absent, unknown) is `none`. */
export function runPermissionPreset(value: unknown): RunPermissionPreset {
  return value === 'bypass' ? 'bypass' : 'none'
}

export const runScheduledAction: AutomationActionProvider = {
  kind: 'calendar.run-scheduled',
  label: 'Run a calendar event',
  summary: 'Starts a chat with the event as its brief.',
  configSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string' },
      cli: { type: 'string' },
      cliModel: { type: 'string' },
      permissionPreset: { type: 'string', enum: ['none', 'bypass'] },
      eventId: { type: 'string' },
      eventTitle: { type: 'string' },
    },
    required: ['prompt'],
  },
  run: async (config, ctx: ActionContext) => {
    const cfg = (config ?? {}) as {
      prompt?: string
      cli?: string
      cliModel?: string
      permissionPreset?: string
      eventTitle?: string
    }
    if (typeof cfg.prompt !== 'string' || cfg.prompt.trim().length === 0) {
      return { status: 'failed', summary: 'Calendar run config had no prompt.' }
    }
    ctx.reportProgress({ summary: `Calendar: launching "${cfg.eventTitle ?? 'scheduled event'}".` })
    // The run's agent is a chat. The permission preset is always passed, so a
    // run never inherits a wider default than the one the event recorded.
    const launched = await ctx.spawnAgent({
      folderPath: ctx.workspaceRoot,
      prompt: cfg.prompt,
      permissionPreset: runPermissionPreset(cfg.permissionPreset),
      ...(cfg.cli ? { cli: cfg.cli } : {}),
      ...(cfg.cliModel ? { model: cfg.cliModel } : {}),
      name: cfg.eventTitle ? `Calendar: ${cfg.eventTitle}` : 'Calendar run',
    })
    // Still running: the host finishes the run when the chat's turn ends.
    return {
      status: 'running',
      summary: `Calendar event chat ${launched.agentId} started; working…`,
      workspaceId: launched.workspaceId,
      agentId: launched.agentId,
      sessionId: launched.sessionId,
    }
  },
}

export async function scheduleEvent(host: MainHost, request: ScheduleRequest): Promise<ScheduleResponse> {
  const { event } = request
  const workspaceRoot = await resolveWorkspaceRoot(host, request.workspaceId)
  const automations = getAutomationsService(host)
  const created = await automations.create({
    workspaceRoot,
    draft: {
      name: `Calendar: ${event.title}`,
      status: 'enabled',
      trigger: {
        kind: 'schedule',
        config: {
          kind: 'schedule',
          cadence: cadenceFor(event),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        } satisfies ScheduleTriggerConfig,
      },
      action: {
        kind: 'calendar.run-scheduled',
        config: {
          prompt: runPrompt(event),
          eventId: event.id,
          eventTitle: event.title,
          permissionPreset: runPermissionPreset(event.permissionPreset),
          ...(event.cli ? { cli: event.cli } : {}),
          ...(event.cliModel ? { cliModel: event.cliModel } : {}),
        },
      },
    },
  })
  if (!created.ok) return { ok: false, code: created.code, message: created.message }
  return { ok: true, automationId: created.automation.id }
}

// ── Backlog items from Task events ───────────────────────────────────────────
// Frontmatter follows docs/backlog-item-schema.md: status only — the app
// assigns ids on scan; unknown `type` values are preserved, so none is set.

export function writeBacklogItem(
  workspaceRoot: string,
  input: { title: string; description?: string },
  now: Date = new Date()
): CreateBacklogItemResponse {
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'task'
  const date = now.toISOString().slice(0, 10)
  let relativePath = `backlog/${date}-${slug}.md`
  let counter = 2
  while (existsSync(join(workspaceRoot, relativePath))) {
    relativePath = `backlog/${date}-${slug}-${counter}.md`
    counter += 1
  }
  const absolute = join(workspaceRoot, relativePath)
  mkdirSync(dirname(absolute), { recursive: true })
  const body = [
    '---',
    'status: ready',
    '---',
    '',
    `# ${input.title}`,
    '',
    input.description?.trim() ? `${input.description.trim()}\n` : '',
    '_Created from a SprintEngine Calendar task._',
    '',
  ].join('\n')
  writeFileSync(absolute, body, 'utf8')
  return { relativePath, path: absolute }
}

// ── Run readout: the chats scheduled runs started ────────────────────────────
// The conversation service lists only chats this module started, which is
// exactly the calendar's runs. The panel reads them over CH_RUNS and re-reads
// on TOPIC_RUNS_CHANGED.

const LIVE_STATUSES = new Set(['starting', 'ready', 'active', 'awaiting_approval'])

export function toCalendarRuns(conversations: ModuleConversationSummary[]): CalendarRun[] {
  return conversations
    .filter((conversation) => LIVE_STATUSES.has(conversation.status))
    .map(({ workspaceId, agentId, name, status }) => ({ workspaceId, agentId, name, status }))
}

function conversationsAvailable(host: MainHost): boolean {
  return host.supports('conversations')
}

// ── Registration ─────────────────────────────────────────────────────────────

export const registerMain: RegisterMain = (host) => {
  registerAutomationAction(host, runScheduledAction)
  const storage = getModuleStorage(host)

  host.registerIpc(CH_PING, async () => ({ ok: true, module: 'calendar' }))

  host.registerIpc(CH_EVENTS_LOAD, async (_event, payload: unknown) => {
    const workspaceId = requireWorkspaceId((payload as EventsLoadRequest | undefined)?.workspaceId, CH_EVENTS_LOAD)
    return { events: await loadEvents(host, storage, workspaceId) }
  })

  host.registerIpc(CH_EVENTS_SAVE, async (_event, payload: unknown) => {
    const { workspaceId, events } = (payload ?? {}) as Partial<EventsSaveRequest>
    if (!Array.isArray(events)) throw new Error(`${CH_EVENTS_SAVE} requires an events array.`)
    await saveEvents(host, storage, requireWorkspaceId(workspaceId, CH_EVENTS_SAVE), events)
    return { saved: true }
  })

  host.registerIpc(CH_SCHEDULE, async (_event, payload: unknown) => {
    const request = (payload ?? {}) as Partial<ScheduleRequest>
    const workspaceId = requireWorkspaceId(request.workspaceId, CH_SCHEDULE)
    if (typeof request.event?.start !== 'string') {
      throw new Error(`${CH_SCHEDULE} requires an event with a start time.`)
    }
    return scheduleEvent(host, { workspaceId, event: request.event })
  })

  // A Task event may spawn a real backlog/ item (declared backlog.write).
  host.registerIpc(CH_CREATE_BACKLOG_ITEM, async (_event, payload: unknown) => {
    const { workspaceId, title, description } = (payload ?? {}) as Partial<CreateBacklogItemRequest>
    const id = requireWorkspaceId(workspaceId, CH_CREATE_BACKLOG_ITEM)
    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new Error(`${CH_CREATE_BACKLOG_ITEM} requires a title.`)
    }
    const workspaceRoot = await resolveWorkspaceRoot(host, id)
    return writeBacklogItem(workspaceRoot, {
      title,
      ...(typeof description === 'string' ? { description } : {}),
    })
  })

  host.registerIpc(CH_UNSCHEDULE, async (_event, payload: unknown) => {
    const { workspaceId, automationId } = (payload ?? {}) as Partial<UnscheduleRequest>
    const id = requireWorkspaceId(workspaceId, CH_UNSCHEDULE)
    if (typeof automationId !== 'string') throw new Error(`${CH_UNSCHEDULE} requires an automationId.`)
    const workspaceRoot = await resolveWorkspaceRoot(host, id)
    const result = await getAutomationsService(host).delete({ workspaceRoot, automationId })
    return result.ok
      ? { ok: true }
      : { ok: false, message: `${result.code}: ${result.message}` }
  })

  // Watch the module's chats so the panel hears when a run starts or ends; it
  // re-reads CH_RUNS on every signal (events are signals, not state — no
  // replay). Started at startup, or by the first read when the module loaded
  // after it.
  let stopWatching: (() => void) | undefined
  const ensureWatching = (): void => {
    if (stopWatching || !conversationsAvailable(host)) return
    stopWatching = getConversationService(host).watch(undefined, () => host.emit(TOPIC_RUNS_CHANGED))
  }
  host.onStartup(ensureWatching)
  host.onShutdown(() => {
    stopWatching?.()
    stopWatching = undefined
  })

  host.registerIpc(CH_RUNS, async (): Promise<RunsResponse> => {
    if (!conversationsAvailable(host)) return { available: false, runs: [] }
    ensureWatching()
    return { available: true, runs: toCalendarRuns(getConversationService(host).list()) }
  })
}

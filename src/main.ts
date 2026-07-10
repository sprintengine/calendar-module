// entry.main — Node-side half of the calendar module. Owns event persistence,
// automation creation (the scheduling engine), and the action provider that
// actually runs scheduled events through the shared session runtime.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  getAutomationsService,
  getModuleStorage,
  registerAutomationAction,
  WorkspaceContextToken,
  type ActionContext,
  type AutomationActionProvider,
  type MainHost,
  type ModuleStorageService,
  type RegisterMain,
  type ScheduleTriggerConfig,
} from '@multicode/module-sdk'

import {
  CH_CREATE_BACKLOG_ITEM,
  CH_EVENTS_LOAD,
  CH_EVENTS_SAVE,
  CH_PING,
  CH_SCHEDULE,
  CH_UNSCHEDULE,
  type CalendarEvent,
  type EventsFile,
  type EventsLoadRequest,
  type EventsSaveRequest,
  type ScheduleRequest,
  type ScheduleResponse,
  type UnscheduleRequest,
} from './types'

// ── Event persistence ────────────────────────────────────────────────────────
// Events persist through the SDK's module storage (host-placed): per-workspace
// data lives inside the workspace folder (`.multi-code/modules/calendar/`),
// resolved from workspaceId via the workspace context. A folderless (or
// not-yet-resolvable) workspace falls back to the module's global per-user
// store under a workspace-derived key, so the calendar still works there.
// (Formerly hand-rolled JSON under ~/.multicode/calendar-data — undisclosed
// home-dir writes; resolved by SDK storage + workspace context.)

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
  return view?.folderPath ? { key: EVENTS_KEY, workspaceRoot: view.folderPath } : { key: globalEventsKey(workspaceId) }
}

async function loadEvents(host: MainHost, storage: ModuleStorageService, workspaceId: string): Promise<CalendarEvent[]> {
  const scope = await eventsScope(host, workspaceId)
  const record = await storage.get(scope)
  if (!record.ok || !record.found) return []
  const parsed = record.value as Partial<EventsFile>
  if (parsed.version !== 1 || !Array.isArray(parsed.events)) return []
  return parsed.events
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

function cadenceFor(event: CalendarEvent): ScheduleTriggerConfig['cadence'] {
  const timeLocal = event.start.slice(11, 16)
  if (event.repeat === 'daily') return { type: 'daily', timeLocal }
  if (event.repeat === 'weekly') {
    const day = new Date(`${event.start}:00`).getDay()
    return { type: 'weekly', timeLocal, daysOfWeek: [day] }
  }
  return { type: 'at', datetime: event.start }
}

function runPrompt(event: CalendarEvent): string {
  const lines: string[] = []
  if (event.kind === 'sprint') {
    // SDK-FINDINGS: there is no SDK surface to start a Sprint Engine run from a
    // plan/backlog item (createPlanSourcedSprintEngineWorkspace is app-internal).
    // Sanctioned fallback: spawn an agent through the shared runtime and hand it
    // the source item as its brief.
    lines.push(
      'You are running a scheduled sprint-style work session created from a Multicode Calendar event.'
    )
  } else {
    lines.push('You are running a scheduled task created from a Multicode Calendar event.')
  }
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

const runScheduledAction: AutomationActionProvider = {
  kind: 'calendar.run-scheduled',
  configSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string' },
      cli: { type: 'string' },
      cliModel: { type: 'string' },
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
      eventTitle?: string
    }
    if (typeof cfg.prompt !== 'string' || cfg.prompt.trim().length === 0) {
      return { status: 'failed', summary: 'Calendar run config had no prompt.' }
    }
    ctx.reportProgress({ summary: `Calendar: launching "${cfg.eventTitle ?? 'scheduled event'}".` })
    const spawned = await ctx.spawnAgent({
      folderPath: ctx.workspaceRoot,
      prompt: cfg.prompt,
      ...(cfg.cli ? { cli: cfg.cli } : {}),
      ...(cfg.cliModel ? { cliModel: cfg.cliModel } : {}),
      name: cfg.eventTitle ? `Calendar: ${cfg.eventTitle}` : 'Calendar run',
    })
    return {
      status: 'completed',
      summary: `Calendar event agent spawned (${spawned.agentId}).`,
      workspaceId: spawned.workspaceId,
      agentId: spawned.agentId,
    }
  },
}

async function scheduleEvent(host: MainHost, request: ScheduleRequest): Promise<ScheduleResponse> {
  const { workspaceRoot, event } = request
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
          ...(event.cli ? { cli: event.cli } : {}),
          ...(event.cliModel ? { cliModel: event.cliModel } : {}),
        },
      },
      autonomyDefault: 'review_only',
    },
  })
  if (!created.ok) return { ok: false, code: created.code, message: created.message }
  return { ok: true, automationId: created.automation.id }
}

// ── Registration ─────────────────────────────────────────────────────────────

export const registerMain: RegisterMain = (host) => {
  registerAutomationAction(host, runScheduledAction)
  const storage = getModuleStorage(host)

  host.registerIpc(CH_PING, async () => ({ ok: true, module: 'calendar' }))

  host.registerIpc(CH_EVENTS_LOAD, async (_event, payload: unknown) => {
    const { workspaceId } = payload as EventsLoadRequest
    if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
      throw new Error('calendar:events-load requires a workspaceId.')
    }
    return { events: await loadEvents(host, storage, workspaceId) }
  })

  host.registerIpc(CH_EVENTS_SAVE, async (_event, payload: unknown) => {
    const { workspaceId, events } = payload as EventsSaveRequest
    if (typeof workspaceId !== 'string' || workspaceId.length === 0 || !Array.isArray(events)) {
      throw new Error('calendar:events-save requires workspaceId and an events array.')
    }
    await saveEvents(host, storage, workspaceId, events)
    return { saved: true }
  })

  host.registerIpc(CH_SCHEDULE, async (_event, payload: unknown) => {
    const request = payload as ScheduleRequest
    if (
      typeof request?.workspaceRoot !== 'string'
      || request.workspaceRoot.length === 0
      || typeof request?.event?.start !== 'string'
    ) {
      throw new Error('calendar:schedule requires workspaceRoot and an event with a start time.')
    }
    return scheduleEvent(host, request)
  })

  // A Task event may spawn a real backlog/ item (declared backlog.write).
  // Frontmatter follows docs/backlog-item-schema.md: status only — the app
  // assigns ids on scan; unknown `type` values are preserved, so none is set.
  host.registerIpc(CH_CREATE_BACKLOG_ITEM, async (_event, payload: unknown) => {
    const { workspaceRoot, title, description } = payload as {
      workspaceRoot?: string
      title?: string
      description?: string
    }
    if (!workspaceRoot || !title || typeof workspaceRoot !== 'string' || typeof title !== 'string') {
      throw new Error('calendar:create-backlog-item requires workspaceRoot and title.')
    }
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'task'
    const date = new Date().toISOString().slice(0, 10)
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
      `# ${title}`,
      '',
      description?.trim() ? `${description.trim()}\n` : '',
      '_Created from a Multicode Calendar task._',
      '',
    ].join('\n')
    writeFileSync(absolute, body, 'utf8')
    return { relativePath, path: absolute }
  })

  host.registerIpc(CH_UNSCHEDULE, async (_event, payload: unknown) => {
    const { workspaceRoot, automationId } = payload as UnscheduleRequest
    if (typeof workspaceRoot !== 'string' || typeof automationId !== 'string') {
      throw new Error('calendar:unschedule requires workspaceRoot and automationId.')
    }
    const result = await getAutomationsService(host).delete({ workspaceRoot, automationId })
    return result.ok
      ? { ok: true }
      : { ok: false, message: `${result.code}: ${result.message}` }
  })
}

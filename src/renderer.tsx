// entry.renderer — registers the calendar workspace type, panels (week/day/
// month views), Backlog integration, and commands. Bundled as single-file ESM
// with React external (resolved to the app's instance via its import map).

import type {
  BacklogItemActionContext,
  RegisterRenderer,
  RendererHost,
  WorkspaceLayoutTemplate,
  WorkspacePanelProps,
} from '@sprintengine/module-sdk'

import {
  CH_EVENTS_LOAD,
  CH_EVENTS_SAVE,
  CH_SCHEDULE,
  type CalendarEvent,
  type EventsLoadResponse,
  type ScheduleResponse,
} from './types'
import { requestNewEvent, requestPlanDay, requestReveal, requestScheduleOnCalendar } from './ui/bus'
import { CalendarPanel } from './ui/CalendarPanel'
import { toLocalDateTime } from './ui/dates'
import { CalendarIcon } from './ui/icons'
import { injectStylesOnce } from './ui/styles'

function createCalendarTemplate(): WorkspaceLayoutTemplate {
  return {
    id: 'calendar-week',
    name: 'Calendar',
    description: 'Week grid with a planning rail: drop work onto time.',
    previewSlots: [
      { x: 4, y: 4, w: 236, h: 102, type: 'editor', label: 'Week' },
      { x: 244, y: 4, w: 52, h: 102, type: 'explorer', label: 'Plan' },
    ],
    layout: {
      global: { tabSetEnableDrop: true, tabEnableClose: true },
      layout: {
        type: 'row',
        children: [
          {
            type: 'tabset',
            weight: 100,
            children: [{ type: 'tab', name: 'Calendar', component: 'calendar.week' }],
          },
        ],
      },
    },
  }
}

export const registerRenderer: RegisterRenderer = (host: RendererHost) => {
  injectStylesOnce()

  host.registerPanel('calendar.week', (props: WorkspacePanelProps) => (
    <CalendarPanel {...props} host={host} initialView="week" />
  ))
  host.registerPanel('calendar.day', (props: WorkspacePanelProps) => (
    <CalendarPanel {...props} host={host} initialView="day" />
  ))
  host.registerPanel('calendar.month', (props: WorkspacePanelProps) => (
    <CalendarPanel {...props} host={host} initialView="month" />
  ))

  host.registerWorkspaceType({
    id: 'calendar',
    label: 'Calendar',
    description: 'A time-gridded planner: notes and tasks on your week, and Backlog items, automations, and sprints scheduled to run at a time.',
    icon: CalendarIcon,
    accentToken: '--tone-accent',
    searchTerms: ['calendar', 'schedule', 'planner', 'outlook', 'week', 'agenda', 'time block'],
    createTemplate: createCalendarTemplate,
    topBarViews: {
      label: 'Calendar',
      views: [
        { component: 'calendar.day', name: 'Day' },
        { component: 'calendar.week', name: 'Week' },
        { component: 'calendar.month', name: 'Month' },
      ],
    },
    pickerOrder: 40,
  })

  // ── Backlog integration beyond the panel ───────────────────────────────────

  host.registerBacklogItemAction({
    id: 'schedule-on-calendar',
    label: 'Schedule on calendar…',
    category: 'execute',
    isVisible: (context) => context.item.status !== 'completed' && context.item.status !== 'archived',
    run: async (context) => scheduleFromBacklog(host, context),
  })

  host.registerBacklogLinkProvider({
    moduleId: 'calendar',
    targetKinds: ['calendar.event'],
    resolveLinkStatus: async ({ workspaceId, link }) => {
      try {
        const response = (await host.invoke(CH_EVENTS_LOAD, { workspaceId })) as EventsLoadResponse
        const exists = response.events.some((event) => event.id === link.target.id)
        return { ...link, status: exists ? 'active' : 'unknown', canOpen: exists }
      } catch {
        return { ...link, status: 'unknown', canOpen: false }
      }
    },
    openLink: async ({ workspaceId, link }) =>
      requestReveal({ workspaceId, eventId: link.target.id }),
  })

  // ── Palette commands (also reachable from the in-panel ⌘K bar) ─────────────

  host.registerCommand({
    id: 'new-event',
    title: 'Calendar: New Event',
    category: 'Calendar',
    scopes: ['global'],
    availability: ['activeWorkspace'],
    run: () => {
      if (!requestNewEvent()) {
        console.info('[calendar] No calendar panel is open — open a Calendar workspace first.')
      }
    },
  })

  host.registerCommand({
    id: 'plan-my-day',
    title: 'Calendar: Plan My Day',
    category: 'Calendar',
    scopes: ['global'],
    availability: ['activeWorkspace'],
    run: () => {
      if (!requestPlanDay()) {
        console.info('[calendar] No calendar panel is open — open a Calendar workspace first.')
      }
    },
  })
}

// The Backlog panel action: hand off to a mounted calendar panel when one is
// open (pre-filled editor); otherwise create + schedule directly for the next
// morning 09:00 so the action still works headlessly. Either way, stamp the
// module metadata; the direct path also links the item to the created event.
async function scheduleFromBacklog(host: RendererHost, context: BacklogItemActionContext): Promise<void> {
  const claimed = requestScheduleOnCalendar({
    workspaceId: context.workspaceId,
    workspaceRoot: context.workspaceRoot,
    path: context.item.path,
    title: context.item.title,
  })
  if (claimed) {
    await context.updateModuleMetadata('calendar', {
      scheduleRequestedAt: new Date().toISOString(),
    })
    return
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)
  const stamp = toLocalDateTime(new Date())
  const event: CalendarEvent = {
    id: `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: context.item.title,
    kind: 'automation',
    start: toLocalDateTime(tomorrow),
    durationMinutes: 30,
    source: { path: context.item.path, title: context.item.title },
    createdAt: stamp,
    updatedAt: stamp,
  }
  const scheduled = (await host.invoke(CH_SCHEDULE, {
    workspaceRoot: context.workspaceRoot,
    event,
  })) as ScheduleResponse
  if (!scheduled.ok) throw new Error(`${scheduled.code}: ${scheduled.message}`)
  event.automationId = scheduled.automationId

  const response = (await host.invoke(CH_EVENTS_LOAD, {
    workspaceId: context.workspaceId,
  })) as EventsLoadResponse
  await host.invoke(CH_EVENTS_SAVE, {
    workspaceId: context.workspaceId,
    events: [...response.events, event],
  })

  await context.addLink({
    id: 'calendar:scheduled-event',
    moduleId: 'calendar',
    type: 'execution',
    label: `Scheduled: ${event.start.replace('T', ' ')}`,
    target: { kind: 'calendar.event', id: event.id },
    status: 'active',
    updatedAt: new Date().toISOString(),
  })
  await context.updateModuleMetadata('calendar', {
    eventId: event.id,
    scheduledStart: event.start,
    automationId: event.automationId,
  })
}

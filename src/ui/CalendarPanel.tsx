// The calendar workspace panel: owns event state (persisted through the
// module bridge), Backlog integration (planning rail + drops), scheduling
// (events → real Automations via entry.main), and the editor overlay.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  readFileDropPayload,
  type BacklogItemView,
  type RendererHost,
  type WorkspacePanelProps,
} from '@multicode/module-sdk'

import {
  CH_CREATE_BACKLOG_ITEM,
  CH_EVENTS_LOAD,
  CH_EVENTS_SAVE,
  CH_SCHEDULE,
  CH_UNSCHEDULE,
  type CalendarEvent,
  type EventsLoadResponse,
  type ScheduleResponse,
} from '../types'
import { planDay } from './autoSchedule'
import {
  NEW_EVENT_REQUEST,
  PLAN_DAY_REQUEST,
  REVEAL_EVENT,
  SCHEDULE_REQUEST_EVENT,
  onBusEvent,
  type RevealDetail,
  type ScheduleRequestDetail,
} from './bus'
import { CommandBar, type CommandBarAction } from './CommandBar'
import { addDays, dayTitle, monthTitle, parseLocalDateTime, startOfWeek, toLocalDateTime, weekTitle } from './dates'
import { EventEditor, type SaveOptions } from './EventEditor'
import { MonthView } from './MonthView'
import { PlanningRail } from './PlanningRail'
import { CALENDAR_DROP_MIME, TimeGrid, type CalendarDropPayload, type DropTarget } from './TimeGrid'

export type CalendarView = 'day' | 'week' | 'month'

export type CalendarPanelProps = WorkspacePanelProps & {
  host: RendererHost
  initialView: CalendarView
}

function newId(): string {
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** `id:` from backlog frontmatter → display id (`MC-42`). SDK-FINDINGS: the
 * BacklogItemView carries no numericId/displayId, so the module re-derives it. */
function deriveDisplayId(item: BacklogItemView, key: string): string | undefined {
  const match = /^---\n[\s\S]*?\bid:\s*(\d+)\s*$/m.exec(item.sourceContent.slice(0, 2000))
  return match ? `${key}-${match[1]}` : undefined
}

function deriveWorkspaceRoot(items: BacklogItemView[]): string | null {
  const item = items[0]
  if (!item) return null
  const suffix = `/${item.relativePath}`
  return item.path.endsWith(suffix) ? item.path.slice(0, -suffix.length) : null
}

export function CalendarPanel({ workspaceId, host, initialView }: CalendarPanelProps) {
  const [view, setView] = useState<CalendarView>(initialView)
  const [focusDate, setFocusDate] = useState(() => new Date())
  const [now, setNow] = useState(() => new Date())
  const [events, setEvents] = useState<CalendarEvent[] | null>(null)
  const [backlogItems, setBacklogItems] = useState<BacklogItemView[] | null>(null)
  const [backlogUnavailable, setBacklogUnavailable] = useState(false)
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ draft: CalendarEvent; isNew: boolean } | null>(null)
  const [editorError, setEditorError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [cmdkOpen, setCmdkOpen] = useState(false)
  const eventsRef = useRef<CalendarEvent[]>([])

  // ── Clock ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // ── Load + persist events over the bridge ──────────────────────────────────
  useEffect(() => {
    let disposed = false
    setEvents(null)
    setLoadError(null)
    host
      .invoke(CH_EVENTS_LOAD, { workspaceId })
      .then((response) => {
        if (disposed) return
        const loaded = (response as EventsLoadResponse).events
        eventsRef.current = loaded
        setEvents(loaded)
      })
      .catch((error: unknown) => {
        if (!disposed) setLoadError(error instanceof Error ? error.message : String(error))
      })
    return () => {
      disposed = true
    }
  }, [host, workspaceId])

  const persist = useCallback(
    (next: CalendarEvent[]) => {
      eventsRef.current = next
      setEvents(next)
      void host.invoke(CH_EVENTS_SAVE, { workspaceId, events: next }).catch((error: unknown) => {
        setLoadError(`Save failed: ${error instanceof Error ? error.message : String(error)}`)
      })
    },
    [host, workspaceId]
  )

  // ── Backlog rail (live) ────────────────────────────────────────────────────
  useEffect(() => {
    let disposed = false
    setBacklogUnavailable(false)
    setBacklogItems(null)
    let off: (() => void) | undefined
    try {
      off = host.watchBacklogItems(workspaceId, (items) => {
        if (disposed) return
        setBacklogItems(items)
        setWorkspaceRoot((current) => current ?? deriveWorkspaceRoot(items))
      })
    } catch {
      setBacklogUnavailable(true)
    }
    return () => {
      disposed = true
      off?.()
    }
  }, [host, workspaceId])

  const displayIds = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of backlogItems ?? []) {
      const id = deriveDisplayId(item, 'MC')
      if (id) map.set(item.path, id)
    }
    return map
  }, [backlogItems])

  const scheduledPaths = useMemo(() => {
    const set = new Set<string>()
    for (const event of events ?? []) {
      if (event.source) set.add(event.source.path)
    }
    return set
  }, [events])

  const unscheduledTasks = useMemo(
    () => (events ?? []).filter((event) => event.kind === 'task' && event.unscheduled),
    [events]
  )

  // ── Scheduling bridge ──────────────────────────────────────────────────────

  const scheduleIfNeeded = useCallback(
    async (event: CalendarEvent, previous?: CalendarEvent): Promise<CalendarEvent> => {
      const runsAtStart = (event.kind === 'automation' || event.kind === 'sprint') && !event.unscheduled
      // Any change to a scheduled run re-issues the automation record: simplest
      // correct reconciliation, and delete/create are both idempotent enough.
      if (previous?.automationId && workspaceRoot) {
        await host
          .invoke(CH_UNSCHEDULE, { workspaceRoot, automationId: previous.automationId })
          .catch(() => undefined)
      }
      if (!runsAtStart) return { ...event, automationId: undefined }
      if (!workspaceRoot) {
        throw new Error('Workspace folder unknown — cannot create the scheduled automation.')
      }
      const response = (await host.invoke(CH_SCHEDULE, {
        workspaceRoot,
        event,
      })) as ScheduleResponse
      if (!response.ok) throw new Error(`${response.code}: ${response.message}`)
      return { ...event, automationId: response.automationId }
    },
    [host, workspaceRoot]
  )

  // ── Event mutations ────────────────────────────────────────────────────────

  const upsert = useCallback(
    async (event: CalendarEvent) => {
      const previous = eventsRef.current.find((candidate) => candidate.id === event.id)
      const finalEvent = await scheduleIfNeeded(
        { ...event, updatedAt: toLocalDateTime(new Date()) },
        previous
      )
      const rest = eventsRef.current.filter((candidate) => candidate.id !== event.id)
      persist([...rest, finalEvent])
    },
    [persist, scheduleIfNeeded]
  )

  const handleSave = useCallback(
    (event: CalendarEvent, options?: SaveOptions) => {
      setEditorError(null)
      const prepare: Promise<CalendarEvent> =
        options?.addToBacklog && workspaceRoot
          ? host
              .invoke(CH_CREATE_BACKLOG_ITEM, {
                workspaceRoot,
                title: event.title,
                description: event.description,
              })
              .then((response) => {
                const { path } = response as { path: string }
                return { ...event, source: { path, title: event.title } }
              })
          : Promise.resolve(event)
      prepare
        .then((prepared) => upsert(prepared))
        .then(() => setEditor(null))
        .catch((error: unknown) =>
          setEditorError(error instanceof Error ? error.message : String(error))
        )
    },
    [host, upsert, workspaceRoot]
  )

  const handleDelete = useCallback(
    (event: CalendarEvent) => {
      if (event.automationId && workspaceRoot) {
        void host
          .invoke(CH_UNSCHEDULE, { workspaceRoot, automationId: event.automationId })
          .catch(() => undefined)
      }
      persist(eventsRef.current.filter((candidate) => candidate.id !== event.id))
      setEditor(null)
    },
    [host, persist, workspaceRoot]
  )

  const handleMove = useCallback(
    (eventId: string, newStart: string) => {
      const current = eventsRef.current.find((candidate) => candidate.id === eventId)
      if (!current || current.start === newStart) return
      upsert({ ...current, start: newStart }).catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : String(error))
      )
    },
    [upsert]
  )

  const handleResize = useCallback(
    (eventId: string, durationMinutes: number) => {
      const current = eventsRef.current.find((candidate) => candidate.id === eventId)
      if (!current || current.durationMinutes === durationMinutes) return
      upsert({ ...current, durationMinutes }).catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : String(error))
      )
    },
    [upsert]
  )

  // ── Creation paths ─────────────────────────────────────────────────────────

  const openNewEditor = useCallback((partial: Partial<CalendarEvent>) => {
    const stamp = toLocalDateTime(new Date())
    setEditorError(null)
    setEditor({
      isNew: true,
      draft: {
        id: newId(),
        title: '',
        kind: 'note',
        start: toLocalDateTime(new Date()),
        durationMinutes: 30,
        createdAt: stamp,
        updatedAt: stamp,
        ...partial,
      },
    })
  }, [])

  const handleCreateRange = useCallback(
    (start: string, durationMinutes: number) => {
      openNewEditor({ start, durationMinutes })
    },
    [openNewEditor]
  )

  const handleExternalDrop = useCallback(
    (dataTransfer: DataTransfer, target: DropTarget) => {
      // Published contract first: drags from the app's Backlog panel/Files tree.
      const filePayload = readFileDropPayload(dataTransfer)
      if (filePayload) {
        if (filePayload.rootPath) setWorkspaceRoot((current) => current ?? filePayload.rootPath)
        const file = filePayload.files[0]
        const matching = (backlogItems ?? []).find((item) => item.path === file.path)
        openNewEditor({
          kind: 'automation',
          start: target.start,
          durationMinutes: 30,
          title: matching?.title ?? file.name.replace(/\.md$/, ''),
          source: {
            path: file.path,
            title: matching?.title,
            displayId: displayIds.get(file.path),
          },
        })
        return
      }
      const raw = dataTransfer.getData(CALENDAR_DROP_MIME)
      if (!raw) return
      try {
        const payload = JSON.parse(raw) as CalendarDropPayload
        if (payload.kind === 'rail-backlog') {
          openNewEditor({
            kind: 'automation',
            start: target.start,
            durationMinutes: 30,
            title: payload.title,
            source: {
              path: payload.path,
              title: payload.title,
              displayId: payload.displayId ?? displayIds.get(payload.path),
            },
          })
        } else if (payload.kind === 'rail-task') {
          const task = eventsRef.current.find((candidate) => candidate.id === payload.eventId)
          if (task) {
            upsert({ ...task, start: target.start, unscheduled: undefined }).catch(
              (error: unknown) =>
                setLoadError(error instanceof Error ? error.message : String(error))
            )
          }
        }
      } catch {
        // Unknown drag payload — ignore.
      }
    },
    [backlogItems, displayIds, openNewEditor, upsert]
  )

  // ── Module bus: Backlog action / commands / link provider → this panel ─────

  useEffect(() => {
    const offSchedule = onBusEvent<ScheduleRequestDetail>(SCHEDULE_REQUEST_EVENT, (detail) => {
      if (detail.workspaceId !== workspaceId) return
      detail.claim()
      setWorkspaceRoot((current) => current ?? detail.workspaceRoot)
      const nextHour = new Date()
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0)
      openNewEditor({
        kind: 'automation',
        start: toLocalDateTime(nextHour),
        durationMinutes: 30,
        title: detail.title,
        source: { path: detail.path, title: detail.title, displayId: detail.displayId },
      })
    })
    const offReveal = onBusEvent<RevealDetail>(REVEAL_EVENT, (detail) => {
      if (detail.workspaceId !== workspaceId) return
      const event = eventsRef.current.find((candidate) => candidate.id === detail.eventId)
      if (!event) return
      detail.claim()
      setFocusDate(parseLocalDateTime(event.start))
      setEditorError(null)
      setEditor({ draft: event, isNew: false })
    })
    const offNew = onBusEvent<object>(NEW_EVENT_REQUEST, (detail) => {
      ;(detail as { claim(): void }).claim()
      openNewEditor({})
    })
    const offPlan = onBusEvent<object>(PLAN_DAY_REQUEST, (detail) => {
      ;(detail as { claim(): void }).claim()
      planMyDay()
    })
    return () => {
      offSchedule()
      offReveal()
      offNew()
      offPlan()
    }
    // planMyDay is stable enough per render; listeners re-bind on data change.
  })

  // ── Plan my day (auto-schedule) ────────────────────────────────────────────

  function planMyDay() {
    const day = new Date()
    const taskCandidates = unscheduledTasks.map((task) => ({
      key: `task:${task.id}`,
      durationMinutes: task.durationMinutes || 30,
    }))
    const railItems = (backlogItems ?? [])
      .filter(
        (item) =>
          item.status !== 'completed'
          && item.status !== 'archived'
          && item.type !== 'epic'
          && !scheduledPaths.has(item.path)
      )
      .slice(0, 3)
    const itemCandidates = railItems.map((item) => ({ key: `item:${item.path}`, durationMinutes: 45 }))
    const placements = planDay(day, events ?? [], [...taskCandidates, ...itemCandidates], new Date())
    if (placements.length === 0) return

    const stamp = toLocalDateTime(new Date())
    let next = [...eventsRef.current]
    for (const placement of placements) {
      if (placement.key.startsWith('task:')) {
        const id = placement.key.slice(5)
        next = next.map((candidate) =>
          candidate.id === id
            ? { ...candidate, start: placement.start, unscheduled: undefined, updatedAt: stamp }
            : candidate
        )
      } else {
        const path = placement.key.slice(5)
        const item = railItems.find((candidate) => candidate.path === path)
        if (!item) continue
        next.push({
          id: newId(),
          title: item.title,
          kind: 'task',
          start: placement.start,
          durationMinutes: 45,
          source: { path: item.path, title: item.title, displayId: displayIds.get(item.path) },
          createdAt: stamp,
          updatedAt: stamp,
        })
      }
    }
    persist(next)
  }

  // ── Command bar actions ────────────────────────────────────────────────────

  const commandActions: CommandBarAction[] = [
    { id: 'new', label: 'New event', run: () => openNewEditor({}) },
    { id: 'today', label: 'Go to today', run: () => setFocusDate(new Date()) },
    { id: 'tomorrow', label: 'Jump to tomorrow', run: () => setFocusDate(addDays(new Date(), 1)) },
    { id: 'day', label: 'Day view', run: () => setView('day') },
    { id: 'week', label: 'Week view', run: () => setView('week') },
    { id: 'month', label: 'Month view', run: () => setView('month') },
    { id: 'plan', label: 'Plan my day (auto-schedule)', hint: 'Time-block unscheduled work into free slots today', run: () => planMyDay() },
    ...(backlogItems ?? [])
      .filter((item) => item.status !== 'completed' && item.status !== 'archived' && item.type !== 'epic' && !scheduledPaths.has(item.path))
      .slice(0, 8)
      .map((item) => ({
        id: `schedule:${item.path}`,
        label: `Schedule: ${item.title}`,
        hint: displayIds.get(item.path),
        run: () => {
          const nextHour = new Date()
          nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0)
          openNewEditor({
            kind: 'automation',
            start: toLocalDateTime(nextHour),
            durationMinutes: 30,
            title: item.title,
            source: { path: item.path, title: item.title, displayId: displayIds.get(item.path) },
          })
        },
      })),
  ]

  // ── Navigation ─────────────────────────────────────────────────────────────

  const days = useMemo(() => {
    if (view === 'day') return [focusDate]
    const weekStart = startOfWeek(focusDate)
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }, [view, focusDate])

  const title =
    view === 'month' ? monthTitle(focusDate) : view === 'day' ? dayTitle(focusDate) : weekTitle(startOfWeek(focusDate))

  function navigate(direction: -1 | 1) {
    const step = view === 'month' ? 0 : view === 'day' ? 1 : 7
    if (view === 'month') {
      setFocusDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1))
    } else {
      setFocusDate((current) => addDays(current, step * direction))
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="mccal-root"
      onKeyDown={(keyEvent) => {
        if ((keyEvent.metaKey || keyEvent.ctrlKey) && keyEvent.key.toLowerCase() === 'k') {
          keyEvent.preventDefault()
          keyEvent.stopPropagation()
          setCmdkOpen(true)
        }
      }}
    >
      <div className="mccal-bar">
        <span className="mccal-title">{title}</span>
        <button type="button" className="mccal-btn" onClick={() => navigate(-1)} aria-label="Previous">
          ‹
        </button>
        <button type="button" className="mccal-btn" onClick={() => setFocusDate(new Date())}>
          Today
        </button>
        <button type="button" className="mccal-btn" onClick={() => navigate(1)} aria-label="Next">
          ›
        </button>
        <span className="mccal-bar-spacer" />
        <div className="mccal-viewgroup" role="radiogroup" aria-label="Calendar view">
          {(['day', 'week', 'month'] as const).map((candidate) => (
            <button
              key={candidate}
              type="button"
              className="mccal-btn"
              aria-pressed={view === candidate}
              onClick={() => setView(candidate)}
            >
              {candidate[0].toUpperCase() + candidate.slice(1)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="mccal-btn"
          onClick={() => setCmdkOpen(true)}
          aria-label="Open calendar commands"
        >
          <span className="mccal-kbd">⌘K</span>
        </button>
        <button type="button" className="mccal-btn mccal-primary" onClick={() => openNewEditor({})}>
          New event
        </button>
      </div>

      {loadError ? <div className="mccal-error" role="alert" style={{ padding: '4px 10px' }}>{loadError}</div> : null}

      <div className="mccal-body" style={{ position: 'relative' }}>
        {view === 'month' ? (
          <MonthView
            focusDate={focusDate}
            events={events ?? []}
            now={now}
            onOpenDay={(day) => {
              setFocusDate(day)
              setView('day')
            }}
            onOpen={(event) => {
              setEditorError(null)
              setEditor({ draft: event, isNew: false })
            }}
          />
        ) : (
          <TimeGrid
            days={days}
            events={(events ?? []).filter((event) => !event.unscheduled)}
            now={now}
            onCreateRange={handleCreateRange}
            onMove={handleMove}
            onResize={handleResize}
            onOpen={(event) => {
              setEditorError(null)
              setEditor({ draft: event, isNew: false })
            }}
            onExternalDrop={handleExternalDrop}
          />
        )}

        <PlanningRail
          backlogItems={backlogItems}
          backlogUnavailable={backlogUnavailable}
          unscheduledTasks={unscheduledTasks}
          scheduledPaths={scheduledPaths}
          displayIds={displayIds}
          workspaceRoot={workspaceRoot}
          onOpenTask={(task) => {
            setEditorError(null)
            setEditor({ draft: task, isNew: false })
          }}
        />

        {editor ? (
          <EventEditor
            draft={editor.draft}
            isNew={editor.isNew}
            canSchedule={workspaceRoot !== null}
            error={editorError}
            onSave={handleSave}
            onDelete={handleDelete}
            onClose={() => setEditor(null)}
          />
        ) : null}

        {cmdkOpen ? <CommandBar actions={commandActions} onClose={() => setCmdkOpen(false)} /> : null}
      </div>
    </div>
  )
}

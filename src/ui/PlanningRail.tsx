// Akiflow-style planning rail: unscheduled Backlog items (live via the SDK's
// Backlog read API) and unscheduled personal tasks, draggable onto the grid.
// Backlog cards also originate app-standard file drops (setFileDropData), so
// dragging one into an agent terminal keeps working.

import type { DragEvent as ReactDragEvent } from 'react'

import { setFileDropData, type BacklogItemView } from '@multicode/module-sdk'

import type { CalendarEvent } from '../types'
import { CALENDAR_DROP_MIME } from './TimeGrid'

type PlanningRailProps = {
  backlogItems: BacklogItemView[] | null
  backlogUnavailable: boolean
  unscheduledTasks: CalendarEvent[]
  scheduledPaths: ReadonlySet<string>
  /** path → `MC-###`, derived by the panel (the SDK view has no display id). */
  displayIds: ReadonlyMap<string, string>
  workspaceRoot: string | null
  onOpenTask(event: CalendarEvent): void
}

function tagClass(type: string | undefined): string {
  if (type === 'feature') return 'mccal-tag mccal-tag-feature'
  if (type === 'bug') return 'mccal-tag mccal-tag-bug'
  return 'mccal-tag'
}

export function PlanningRail({
  backlogItems,
  backlogUnavailable,
  unscheduledTasks,
  scheduledPaths,
  displayIds,
  workspaceRoot,
  onOpenTask,
}: PlanningRailProps) {
  const openItems = (backlogItems ?? []).filter(
    (item) =>
      item.status !== 'completed'
      && item.status !== 'archived'
      && item.type !== 'epic'
      && !scheduledPaths.has(item.path)
  )

  function handleBacklogDragStart(event: ReactDragEvent, item: BacklogItemView) {
    if (!event.dataTransfer) return
    const payload = {
      kind: 'rail-backlog' as const,
      path: item.path,
      title: item.title,
      ...(displayIds.get(item.path) ? { displayId: displayIds.get(item.path) } : {}),
    }
    event.dataTransfer.setData(CALENDAR_DROP_MIME, JSON.stringify(payload))
    // Also stamp the app-published file-drop payload so the same drag works on
    // the app's own targets (agent terminals).
    setFileDropData(event.dataTransfer, {
      version: 1,
      workspaceId: null,
      rootPath: workspaceRoot ?? '',
      files: [{ path: item.path, name: item.relativePath.split('/').pop() ?? item.relativePath }],
    })
  }

  function handleTaskDragStart(event: ReactDragEvent, task: CalendarEvent) {
    if (!event.dataTransfer) return
    event.dataTransfer.setData(
      CALENDAR_DROP_MIME,
      JSON.stringify({ kind: 'rail-task' as const, eventId: task.id })
    )
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <aside className="mccal-rail" aria-label="Planning rail">
      <div className="mccal-rail-head">
        <span className="mccal-rt">Plan</span>
        <span className="mccal-rc">
          {backlogItems === null && !backlogUnavailable ? '…' : `${openItems.length} open`}
        </span>
      </div>
      <div className="mccal-rail-body">
        <div className="mccal-rail-sect">Backlog</div>
        {backlogUnavailable ? (
          <div className="mccal-rail-empty">Backlog unavailable in this workspace.</div>
        ) : backlogItems === null ? (
          <div className="mccal-rail-empty">Loading Backlog…</div>
        ) : openItems.length === 0 ? (
          <div className="mccal-rail-empty">Nothing unscheduled. Drag items here from the Backlog panel.</div>
        ) : (
          openItems.map((item) => (
            <div
              key={item.id}
              className="mccal-card"
              draggable
              tabIndex={0}
              aria-label={`Backlog item: ${item.title}. Drag onto the grid to schedule.`}
              onDragStart={(event) => handleBacklogDragStart(event, item)}
            >
              <span className="mccal-card-title">{item.title}</span>
              <span className="mccal-card-meta">
                {displayIds.get(item.path) ? (
                  <span className="mccal-card-id">{displayIds.get(item.path)}</span>
                ) : null}
                {item.type ? <span className={tagClass(item.type)}>{item.type}</span> : null}
              </span>
            </div>
          ))
        )}

        {unscheduledTasks.length > 0 ? (
          <>
            <div className="mccal-rail-sect">Tasks</div>
            {unscheduledTasks.map((task) => (
              <div
                key={task.id}
                className="mccal-card"
                draggable
                tabIndex={0}
                aria-label={`Task: ${task.title}. Drag onto the grid to time-block.`}
                onDragStart={(event) => handleTaskDragStart(event, task)}
                onClick={() => onOpenTask(task)}
              >
                <span className="mccal-card-title">{task.title}</span>
              </div>
            ))}
          </>
        ) : null}
      </div>
    </aside>
  )
}

// The Outlook-style event editor popover. Opened from cell click/drag-create,
// event click, or a Backlog drop (pre-filled, kind defaulting to Automation
// per the brief). Owns no persistence — emits the edited event to the panel.

import { useEffect, useState } from 'react'

import type { ModuleChatRuntimeOption } from '@sprintengine/module-sdk'

import type { CalendarEvent, EventKind, EventRepeat, RunPermissionPreset } from '../types'
import { addMinutes } from './dates'

const KINDS: Array<{ kind: EventKind; label: string }> = [
  { kind: 'note', label: 'Note' },
  { kind: 'task', label: 'Task' },
  { kind: 'automation', label: 'Automation' },
]

const KIND_BAR: Record<EventKind, string> = {
  note: 'var(--mccal-note)',
  task: 'var(--mccal-task)',
  automation: 'var(--mccal-automation)',
}

export type SaveOptions = {
  /** Task kind: also create a real `backlog/` item for this task. */
  addToBacklog?: boolean
}

export type EventEditorProps = {
  draft: CalendarEvent
  isNew: boolean
  /** Scheduling (automation kind) needs a workspace with a folder. */
  canSchedule: boolean
  /** Agent runtimes a scheduled run's chat can use (`RendererHost.listChatRuntimes`). */
  runtimes: ModuleChatRuntimeOption[]
  error: string | null
  onSave(event: CalendarEvent, options?: SaveOptions): void
  onDelete(event: CalendarEvent): void
  onClose(): void
  onOpenSource?(event: CalendarEvent): void
}

export function EventEditor({
  draft,
  isNew,
  canSchedule,
  runtimes,
  error,
  onSave,
  onDelete,
  onClose,
  onOpenSource,
}: EventEditorProps) {
  const [event, setEvent] = useState<CalendarEvent>(draft)
  const [addToBacklog, setAddToBacklog] = useState(false)

  useEffect(() => setEvent(draft), [draft])

  useEffect(() => {
    function onKey(keyEvent: globalThis.KeyboardEvent) {
      if (keyEvent.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const runsAtStart = event.kind === 'automation'
  const runtime = runtimes.find((option) => option.id === event.cli)
  const startDate = event.start.slice(0, 10)
  const startTime = event.start.slice(11, 16)
  const end = addMinutes(event.start, event.durationMinutes)

  function patch(partial: Partial<CalendarEvent>) {
    setEvent((current) => ({ ...current, ...partial }))
  }

  function setStartDate(date: string) {
    if (date) patch({ start: `${date}T${startTime}` })
  }

  function setStartTime(time: string) {
    if (time) patch({ start: `${startDate}T${time}` })
  }

  function setEnd(date: string, time: string) {
    const [y, m, d] = date.split('-').map(Number)
    const [h, min] = time.split(':').map(Number)
    const endStamp = new Date(y, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0)
    const [sy, sm, sd] = startDate.split('-').map(Number)
    const [sh, smin] = startTime.split(':').map(Number)
    const startStamp = new Date(sy, (sm ?? 1) - 1, sd ?? 1, sh ?? 0, smin ?? 0)
    const minutes = Math.round((endStamp.getTime() - startStamp.getTime()) / 60000)
    if (minutes >= 15) patch({ durationMinutes: minutes })
  }

  const scheduleBlocked = runsAtStart && !canSchedule

  return (
    <div className="mccal-scrim" onClick={onClose}>
      <div
        className="mccal-editor"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? 'New calendar event' : `Edit ${event.title}`}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <div className="mccal-ed-kindbar" style={{ background: KIND_BAR[event.kind] }} />
        <div className="mccal-ed-main">
          <div className="mccal-ed-kicker">{isNew ? 'New event' : 'Edit event'}</div>
          <input
            className="mccal-ed-title-in"
            placeholder="Title"
            value={event.title}
            autoFocus
            onChange={(changeEvent) => patch({ title: changeEvent.target.value })}
          />
          {event.source ? (
            <button
              type="button"
              className="mccal-ed-src"
              onClick={() => onOpenSource?.(event)}
              title={event.source.path}
            >
              {event.source.displayId ? (
                <span className="mccal-ed-src-id">{event.source.displayId}</span>
              ) : null}
              <span>{event.source.title ?? event.source.path.split('/').pop()}</span>
            </button>
          ) : null}

          <div className="mccal-kinds" role="radiogroup" aria-label="Event kind">
            {KINDS.map(({ kind, label }) => (
              <button
                key={kind}
                type="button"
                className={`mccal-kbtn mccal-k-${kind}`}
                aria-pressed={event.kind === kind}
                onClick={() => patch({ kind })}
              >
                <span className="mccal-kd" />
                {label}
              </button>
            ))}
          </div>

          <div className="mccal-row2">
            <div className="mccal-field">
              <label htmlFor="mccal-start-date">Start</label>
              <input
                id="mccal-start-date"
                type="date"
                value={startDate}
                onChange={(changeEvent) => setStartDate(changeEvent.target.value)}
              />
            </div>
            <div className="mccal-field">
              <label htmlFor="mccal-start-time">&nbsp;</label>
              <input
                id="mccal-start-time"
                type="time"
                value={startTime}
                onChange={(changeEvent) => setStartTime(changeEvent.target.value)}
              />
            </div>
          </div>

          {runsAtStart ? (
            <div className="mccal-hint">Runs at the start time — no end time.</div>
          ) : (
            <div className="mccal-row2">
              <div className="mccal-field">
                <label htmlFor="mccal-end-date">End</label>
                <input
                  id="mccal-end-date"
                  type="date"
                  value={end.slice(0, 10)}
                  onChange={(changeEvent) => setEnd(changeEvent.target.value, end.slice(11, 16))}
                />
              </div>
              <div className="mccal-field">
                <label htmlFor="mccal-end-time">&nbsp;</label>
                <input
                  id="mccal-end-time"
                  type="time"
                  value={end.slice(11, 16)}
                  onChange={(changeEvent) => setEnd(end.slice(0, 10), changeEvent.target.value)}
                />
              </div>
            </div>
          )}

          <div className="mccal-row2">
            <div className="mccal-field">
              <label htmlFor="mccal-repeat">Repeat</label>
              <select
                id="mccal-repeat"
                value={event.repeat ?? 'none'}
                onChange={(changeEvent) => patch({ repeat: changeEvent.target.value as EventRepeat })}
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            {runsAtStart ? (
              <div className="mccal-field">
                <label htmlFor="mccal-cli">Agent</label>
                <select
                  id="mccal-cli"
                  value={event.cli ?? ''}
                  onChange={(changeEvent) =>
                    patch({ cli: changeEvent.target.value || undefined, cliModel: undefined })
                  }
                >
                  <option value="">Your last-used agent</option>
                  {event.cli && !runtime ? <option value={event.cli}>{event.cli}</option> : null}
                  {runtimes.map((option) => (
                    <option key={option.id} value={option.id} disabled={!option.available}>
                      {option.label}
                      {option.available ? '' : ' (not installed)'}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {runsAtStart ? (
            <div className="mccal-row2">
              {runtime && runtime.models.length > 0 ? (
                <div className="mccal-field">
                  <label htmlFor="mccal-model">Model</label>
                  <select
                    id="mccal-model"
                    value={event.cliModel ?? ''}
                    onChange={(changeEvent) => patch({ cliModel: changeEvent.target.value || undefined })}
                  >
                    <option value="">Default</option>
                    {runtime.models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="mccal-field">
                <label htmlFor="mccal-permissions">Permissions</label>
                <select
                  id="mccal-permissions"
                  value={event.permissionPreset ?? 'none'}
                  onChange={(changeEvent) =>
                    patch({ permissionPreset: changeEvent.target.value as RunPermissionPreset })
                  }
                >
                  <option value="none">Agent's own settings</option>
                  <option value="bypass">Skip every permission prompt</option>
                </select>
              </div>
            </div>
          ) : null}
          {runsAtStart ? (
            <div className="mccal-hint">
              {(event.permissionPreset ?? 'none') === 'bypass'
                ? 'The run\'s chat skips every permission prompt: it acts unattended without asking.'
                : 'The run\'s chat follows the agent CLI\'s own permission settings.'}
            </div>
          ) : null}

          {event.kind === 'task' && isNew && !event.source ? (
            <div className="mccal-field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={addToBacklog}
                  disabled={!canSchedule}
                  onChange={(changeEvent) => setAddToBacklog(changeEvent.target.checked)}
                />
                Also create a Backlog item{!canSchedule ? ' (needs a known workspace folder)' : ''}
              </label>
            </div>
          ) : null}

          <div className="mccal-field">
            <label htmlFor="mccal-desc">Description</label>
            <textarea
              id="mccal-desc"
              rows={2}
              value={event.description ?? ''}
              onChange={(changeEvent) => patch({ description: changeEvent.target.value || undefined })}
            />
          </div>

          {scheduleBlocked ? (
            <div className="mccal-error">
              Can't schedule a run here: this workspace has no folder for the run's agent to
              work in.
            </div>
          ) : null}
          {error ? <div className="mccal-error">{error}</div> : null}

          <div className="mccal-ed-foot">
            {!isNew ? (
              <button type="button" className="mccal-btn mccal-danger" onClick={() => onDelete(event)}>
                Delete
              </button>
            ) : null}
            <span className="mccal-spacer" />
            <button type="button" className="mccal-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="mccal-btn mccal-primary"
              disabled={event.title.trim().length === 0 || scheduleBlocked}
              onClick={() =>
                onSave(
                  { ...event, title: event.title.trim() },
                  addToBacklog && event.kind === 'task' ? { addToBacklog: true } : undefined
                )
              }
            >
              {runsAtStart ? 'Save & schedule' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

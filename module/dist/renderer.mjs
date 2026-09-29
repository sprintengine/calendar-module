// src/types.ts
var CH_EVENTS_LOAD = "calendar:events-load";
var CH_EVENTS_SAVE = "calendar:events-save";
var CH_SCHEDULE = "calendar:schedule";
var CH_UNSCHEDULE = "calendar:unschedule";
var CH_CREATE_BACKLOG_ITEM = "calendar:create-backlog-item";
var CH_RUNS = "calendar:runs";
var TOPIC_RUNS_CHANGED = "runs-changed";

// src/ui/bus.ts
var SCHEDULE_REQUEST_EVENT = "sprintengine-calendar:schedule-request";
var REVEAL_EVENT = "sprintengine-calendar:reveal-event";
var NEW_EVENT_REQUEST = "sprintengine-calendar:new-event";
var PLAN_DAY_REQUEST = "sprintengine-calendar:plan-day";
function dispatchClaimable(name, detail) {
  let claimed = false;
  const payload = { ...detail, claim: () => claimed = true };
  window.dispatchEvent(new CustomEvent(name, { detail: payload }));
  return claimed;
}
function requestScheduleOnCalendar(detail) {
  return dispatchClaimable(SCHEDULE_REQUEST_EVENT, detail);
}
function requestReveal(detail) {
  return dispatchClaimable(REVEAL_EVENT, detail);
}
function requestNewEvent() {
  return dispatchClaimable(NEW_EVENT_REQUEST, {});
}
function requestPlanDay() {
  return dispatchClaimable(PLAN_DAY_REQUEST, {});
}
function onBusEvent(name, handler) {
  const listener = (event) => handler(event.detail);
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}

// src/ui/CalendarPanel.tsx
import { useCallback, useEffect as useEffect4, useMemo as useMemo4, useRef as useRef3, useState as useState4 } from "react";

// node_modules/@sprintengine/module-sdk/dist/plugin-manifest.js
var MARKETPLACE_COMPONENT_KINDS = [
  "mcp",
  "skills",
  "module",
  "automation"
];
var COMPONENT_KIND_SET = new Set(MARKETPLACE_COMPONENT_KINDS);

// node_modules/@sprintengine/module-sdk/dist/index.js
function createServiceToken(key) {
  return { key };
}
var WorkspaceServiceToken = createServiceToken("core.workspace");
var WorkspaceContextToken = createServiceToken("core.workspace-context");
var automationsProviderRegistryToken = createServiceToken("automations.provider-registry");
var automationsModuleServiceToken = createServiceToken("automations.module-service");
var companionAgentsModuleServiceToken = createServiceToken("companion-agents.module-service");
var moduleStorageToken = createServiceToken("core.module-storage");
var SPRINTENGINE_FILE_DROP_MIME = "application/x-sprintengine-file-drop";
function setFileDropData(dataTransfer, payload) {
  const fileText = payload.files.map((file) => file.path).join("\n");
  dataTransfer.effectAllowed = "copy";
  dataTransfer.setData(SPRINTENGINE_FILE_DROP_MIME, JSON.stringify(payload));
  dataTransfer.setData("text/plain", fileText);
}
function hasFileDropData(dataTransfer) {
  const types = Array.from(dataTransfer.types);
  return types.includes(SPRINTENGINE_FILE_DROP_MIME) || types.includes("Files");
}
function readFileDropPayload(dataTransfer) {
  const raw = dataTransfer.getData(SPRINTENGINE_FILE_DROP_MIME);
  if (!raw)
    return null;
  try {
    const value = JSON.parse(raw);
    if (value.version !== 1 || value.workspaceId !== null && typeof value.workspaceId !== "string" || typeof value.rootPath !== "string") {
      return null;
    }
    if (!Array.isArray(value.files))
      return null;
    const files = [];
    for (const file of value.files) {
      if (!file || typeof file.path !== "string" || file.path.trim().length === 0 || typeof file.name !== "string" || file.isDir !== void 0 && typeof file.isDir !== "boolean") {
        continue;
      }
      files.push({
        path: file.path,
        name: file.name,
        ...file.isDir === void 0 ? {} : { isDir: file.isDir }
      });
    }
    if (!files.length)
      return null;
    return {
      version: 1,
      workspaceId: value.workspaceId,
      rootPath: value.rootPath,
      files
    };
  } catch {
    return null;
  }
}

// src/ui/dates.ts
function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}
function toDateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function toLocalDateTime(d) {
  return `${toDateKey(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function parseLocalDateTime(value) {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [y, m, day] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1, h ?? 0, min ?? 0, 0, 0);
}
function startOfWeek(d) {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = out.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  out.setDate(out.getDate() + diff);
  return out;
}
function addDays(d, days) {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}
function addMinutes(value, minutes) {
  const d = parseLocalDateTime(value);
  d.setMinutes(d.getMinutes() + minutes);
  return toLocalDateTime(d);
}
function minutesOfDay(value) {
  const d = parseLocalDateTime(value);
  return d.getHours() * 60 + d.getMinutes();
}
function sameDay(a, b) {
  return toDateKey(a) === toDateKey(b);
}
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
var DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function monthTitle(d) {
  return d.toLocaleDateString(void 0, { month: "long", year: "numeric" });
}
function weekTitle(weekStart) {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const startLabel = weekStart.toLocaleDateString(
    void 0,
    sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" }
  );
  const endLabel = end.toLocaleDateString(void 0, { day: "numeric", month: "short", year: "numeric" });
  return `${startLabel} \u2013 ${endLabel}`;
}
function dayTitle(d) {
  return d.toLocaleDateString(void 0, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

// src/ui/autoSchedule.ts
var DAY_START_MIN = 9 * 60;
var DAY_END_MIN = 18 * 60;
var GAP_MINUTES = 15;
function planDay(day, existingEvents, candidates, now) {
  const busy = existingEvents.filter((event) => !event.allDay && !event.unscheduled && sameDay(parseLocalDateTime(event.start), day)).map((event) => {
    const start = minutesOfDay(event.start);
    return { start, end: start + Math.max(15, event.durationMinutes) };
  }).sort((a, b) => a.start - b.start);
  let cursor = DAY_START_MIN;
  if (sameDay(day, now)) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    cursor = Math.max(cursor, Math.ceil(nowMin / 15) * 15);
  }
  const placements = [];
  const dateKey = toDateKey(day);
  for (const candidate of candidates) {
    const duration = Math.max(15, candidate.durationMinutes);
    let placedAt = null;
    while (cursor + duration <= DAY_END_MIN) {
      const conflict = busy.find((slot) => slot.start < cursor + duration && slot.end > cursor);
      if (!conflict) {
        placedAt = cursor;
        break;
      }
      cursor = Math.max(conflict.end, cursor + 15);
    }
    if (placedAt === null) continue;
    const h = Math.floor(placedAt / 60);
    const m = placedAt % 60;
    placements.push({
      key: candidate.key,
      start: `${dateKey}T${h < 10 ? `0${h}` : h}:${m < 10 ? `0${m}` : m}`
    });
    busy.push({ start: placedAt, end: placedAt + duration });
    busy.sort((a, b) => a.start - b.start);
    cursor = placedAt + duration + GAP_MINUTES;
  }
  return placements;
}

// src/ui/CommandBar.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
function CommandBar({ actions, onClose }) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => inputRef.current?.focus(), []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((action) => action.label.toLowerCase().includes(q));
  }, [actions, query]);
  useEffect(() => setIndex(0), [query]);
  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex((current) => Math.min(filtered.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const action = filtered[index];
      if (action) {
        onClose();
        action.run();
      }
    }
  }
  return /* @__PURE__ */ jsx("div", { className: "mccal-scrim", style: { alignItems: "flex-start", paddingTop: 80 }, onClick: onClose, children: /* @__PURE__ */ jsxs(
    "div",
    {
      className: "mccal-editor",
      style: { width: 420, flexDirection: "column", padding: 8 },
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Calendar commands",
      onClick: (event) => event.stopPropagation(),
      children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            ref: inputRef,
            className: "mccal-ed-title-in",
            style: { marginTop: 0, fontSize: 13 },
            placeholder: "Type a command\u2026 (new event, today, week, plan my day, schedule \u2026)",
            value: query,
            onChange: (event) => setQuery(event.target.value),
            onKeyDown: handleKeyDown,
            role: "combobox",
            "aria-expanded": "true",
            "aria-controls": "mccal-cmdk-list"
          }
        ),
        /* @__PURE__ */ jsx("div", { id: "mccal-cmdk-list", role: "listbox", style: { marginTop: 6, maxHeight: 260, overflowY: "auto" }, children: filtered.length === 0 ? /* @__PURE__ */ jsx("div", { className: "mccal-rail-empty", children: "No matching command." }) : filtered.map((action, i) => /* @__PURE__ */ jsxs(
          "div",
          {
            role: "option",
            "aria-selected": i === index,
            className: "mccal-card",
            style: i === index ? { background: "var(--bg-selected)", borderColor: "var(--border-strong)" } : void 0,
            onMouseEnter: () => setIndex(i),
            onClick: () => {
              onClose();
              action.run();
            },
            children: [
              /* @__PURE__ */ jsx("span", { className: "mccal-card-title", children: action.label }),
              action.hint ? /* @__PURE__ */ jsx("span", { className: "mccal-card-meta", children: action.hint }) : null
            ]
          },
          action.id
        )) })
      ]
    }
  ) });
}

// src/ui/recur.ts
function expandEvents(events, days) {
  const out = [];
  for (const event of events) {
    const base = parseLocalDateTime(event.start);
    const timePart = event.start.slice(11, 16);
    for (const day of days) {
      const onBaseDay = sameDay(base, day);
      let occurs = onBaseDay;
      if (!occurs && event.repeat === "daily") {
        occurs = day.getTime() > base.getTime();
      } else if (!occurs && event.repeat === "weekly") {
        occurs = day.getDay() === base.getDay() && day.getTime() > base.getTime();
      }
      if (!occurs) continue;
      const start = onBaseDay ? event.start : `${toDateKey(day)}T${timePart}`;
      out.push({
        occurrenceKey: `${event.id}@${start}`,
        start,
        isProjection: !onBaseDay,
        event
      });
    }
  }
  return out;
}
function monthGridDays(firstCell) {
  return Array.from({ length: 42 }, (_, i) => addDays(firstCell, i));
}

// src/ui/EventEditor.tsx
import { useEffect as useEffect2, useState as useState2 } from "react";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var KINDS = [
  { kind: "note", label: "Note" },
  { kind: "task", label: "Task" },
  { kind: "automation", label: "Automation" }
];
var KIND_BAR = {
  note: "var(--mccal-note)",
  task: "var(--mccal-task)",
  automation: "var(--mccal-automation)"
};
function EventEditor({
  draft,
  isNew,
  canSchedule,
  runtimes,
  error,
  onSave,
  onDelete,
  onClose,
  onOpenSource
}) {
  const [event, setEvent] = useState2(draft);
  const [addToBacklog, setAddToBacklog] = useState2(false);
  useEffect2(() => setEvent(draft), [draft]);
  useEffect2(() => {
    function onKey(keyEvent) {
      if (keyEvent.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const runsAtStart = event.kind === "automation";
  const runtime = runtimes.find((option) => option.id === event.cli);
  const startDate = event.start.slice(0, 10);
  const startTime = event.start.slice(11, 16);
  const end = addMinutes(event.start, event.durationMinutes);
  function patch(partial) {
    setEvent((current) => ({ ...current, ...partial }));
  }
  function setStartDate(date) {
    if (date) patch({ start: `${date}T${startTime}` });
  }
  function setStartTime(time) {
    if (time) patch({ start: `${startDate}T${time}` });
  }
  function setEnd(date, time) {
    const [y, m, d] = date.split("-").map(Number);
    const [h, min] = time.split(":").map(Number);
    const endStamp = new Date(y, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0);
    const [sy, sm, sd] = startDate.split("-").map(Number);
    const [sh, smin] = startTime.split(":").map(Number);
    const startStamp = new Date(sy, (sm ?? 1) - 1, sd ?? 1, sh ?? 0, smin ?? 0);
    const minutes = Math.round((endStamp.getTime() - startStamp.getTime()) / 6e4);
    if (minutes >= 15) patch({ durationMinutes: minutes });
  }
  const scheduleBlocked = runsAtStart && !canSchedule;
  return /* @__PURE__ */ jsx2("div", { className: "mccal-scrim", onClick: onClose, children: /* @__PURE__ */ jsxs2(
    "div",
    {
      className: "mccal-editor",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": isNew ? "New calendar event" : `Edit ${event.title}`,
      onClick: (clickEvent) => clickEvent.stopPropagation(),
      children: [
        /* @__PURE__ */ jsx2("div", { className: "mccal-ed-kindbar", style: { background: KIND_BAR[event.kind] } }),
        /* @__PURE__ */ jsxs2("div", { className: "mccal-ed-main", children: [
          /* @__PURE__ */ jsx2("div", { className: "mccal-ed-kicker", children: isNew ? "New event" : "Edit event" }),
          /* @__PURE__ */ jsx2(
            "input",
            {
              className: "mccal-ed-title-in",
              placeholder: "Title",
              value: event.title,
              autoFocus: true,
              onChange: (changeEvent) => patch({ title: changeEvent.target.value })
            }
          ),
          event.source ? /* @__PURE__ */ jsxs2(
            "button",
            {
              type: "button",
              className: "mccal-ed-src",
              onClick: () => onOpenSource?.(event),
              title: event.source.path,
              children: [
                event.source.displayId ? /* @__PURE__ */ jsx2("span", { className: "mccal-ed-src-id", children: event.source.displayId }) : null,
                /* @__PURE__ */ jsx2("span", { children: event.source.title ?? event.source.path.split("/").pop() })
              ]
            }
          ) : null,
          /* @__PURE__ */ jsx2("div", { className: "mccal-kinds", role: "radiogroup", "aria-label": "Event kind", children: KINDS.map(({ kind, label }) => /* @__PURE__ */ jsxs2(
            "button",
            {
              type: "button",
              className: `mccal-kbtn mccal-k-${kind}`,
              "aria-pressed": event.kind === kind,
              onClick: () => patch({ kind }),
              children: [
                /* @__PURE__ */ jsx2("span", { className: "mccal-kd" }),
                label
              ]
            },
            kind
          )) }),
          /* @__PURE__ */ jsxs2("div", { className: "mccal-row2", children: [
            /* @__PURE__ */ jsxs2("div", { className: "mccal-field", children: [
              /* @__PURE__ */ jsx2("label", { htmlFor: "mccal-start-date", children: "Start" }),
              /* @__PURE__ */ jsx2(
                "input",
                {
                  id: "mccal-start-date",
                  type: "date",
                  value: startDate,
                  onChange: (changeEvent) => setStartDate(changeEvent.target.value)
                }
              )
            ] }),
            /* @__PURE__ */ jsxs2("div", { className: "mccal-field", children: [
              /* @__PURE__ */ jsx2("label", { htmlFor: "mccal-start-time", children: "\xA0" }),
              /* @__PURE__ */ jsx2(
                "input",
                {
                  id: "mccal-start-time",
                  type: "time",
                  value: startTime,
                  onChange: (changeEvent) => setStartTime(changeEvent.target.value)
                }
              )
            ] })
          ] }),
          runsAtStart ? /* @__PURE__ */ jsx2("div", { className: "mccal-hint", children: "Runs at the start time \u2014 no end time." }) : /* @__PURE__ */ jsxs2("div", { className: "mccal-row2", children: [
            /* @__PURE__ */ jsxs2("div", { className: "mccal-field", children: [
              /* @__PURE__ */ jsx2("label", { htmlFor: "mccal-end-date", children: "End" }),
              /* @__PURE__ */ jsx2(
                "input",
                {
                  id: "mccal-end-date",
                  type: "date",
                  value: end.slice(0, 10),
                  onChange: (changeEvent) => setEnd(changeEvent.target.value, end.slice(11, 16))
                }
              )
            ] }),
            /* @__PURE__ */ jsxs2("div", { className: "mccal-field", children: [
              /* @__PURE__ */ jsx2("label", { htmlFor: "mccal-end-time", children: "\xA0" }),
              /* @__PURE__ */ jsx2(
                "input",
                {
                  id: "mccal-end-time",
                  type: "time",
                  value: end.slice(11, 16),
                  onChange: (changeEvent) => setEnd(end.slice(0, 10), changeEvent.target.value)
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs2("div", { className: "mccal-row2", children: [
            /* @__PURE__ */ jsxs2("div", { className: "mccal-field", children: [
              /* @__PURE__ */ jsx2("label", { htmlFor: "mccal-repeat", children: "Repeat" }),
              /* @__PURE__ */ jsxs2(
                "select",
                {
                  id: "mccal-repeat",
                  value: event.repeat ?? "none",
                  onChange: (changeEvent) => patch({ repeat: changeEvent.target.value }),
                  children: [
                    /* @__PURE__ */ jsx2("option", { value: "none", children: "Does not repeat" }),
                    /* @__PURE__ */ jsx2("option", { value: "daily", children: "Daily" }),
                    /* @__PURE__ */ jsx2("option", { value: "weekly", children: "Weekly" })
                  ]
                }
              )
            ] }),
            runsAtStart ? /* @__PURE__ */ jsxs2("div", { className: "mccal-field", children: [
              /* @__PURE__ */ jsx2("label", { htmlFor: "mccal-cli", children: "Agent" }),
              /* @__PURE__ */ jsxs2(
                "select",
                {
                  id: "mccal-cli",
                  value: event.cli ?? "",
                  onChange: (changeEvent) => patch({ cli: changeEvent.target.value || void 0, cliModel: void 0 }),
                  children: [
                    /* @__PURE__ */ jsx2("option", { value: "", children: "Your last-used agent" }),
                    event.cli && !runtime ? /* @__PURE__ */ jsx2("option", { value: event.cli, children: event.cli }) : null,
                    runtimes.map((option) => /* @__PURE__ */ jsxs2("option", { value: option.id, disabled: !option.available, children: [
                      option.label,
                      option.available ? "" : " (not installed)"
                    ] }, option.id))
                  ]
                }
              )
            ] }) : null
          ] }),
          runsAtStart ? /* @__PURE__ */ jsxs2("div", { className: "mccal-row2", children: [
            runtime && runtime.models.length > 0 ? /* @__PURE__ */ jsxs2("div", { className: "mccal-field", children: [
              /* @__PURE__ */ jsx2("label", { htmlFor: "mccal-model", children: "Model" }),
              /* @__PURE__ */ jsxs2(
                "select",
                {
                  id: "mccal-model",
                  value: event.cliModel ?? "",
                  onChange: (changeEvent) => patch({ cliModel: changeEvent.target.value || void 0 }),
                  children: [
                    /* @__PURE__ */ jsx2("option", { value: "", children: "Default" }),
                    runtime.models.map((model) => /* @__PURE__ */ jsx2("option", { value: model.id, children: model.label }, model.id))
                  ]
                }
              )
            ] }) : null,
            /* @__PURE__ */ jsxs2("div", { className: "mccal-field", children: [
              /* @__PURE__ */ jsx2("label", { htmlFor: "mccal-permissions", children: "Permissions" }),
              /* @__PURE__ */ jsxs2(
                "select",
                {
                  id: "mccal-permissions",
                  value: event.permissionPreset ?? "none",
                  onChange: (changeEvent) => patch({ permissionPreset: changeEvent.target.value }),
                  children: [
                    /* @__PURE__ */ jsx2("option", { value: "none", children: "Agent's own settings" }),
                    /* @__PURE__ */ jsx2("option", { value: "bypass", children: "Skip every permission prompt" })
                  ]
                }
              )
            ] })
          ] }) : null,
          runsAtStart ? /* @__PURE__ */ jsx2("div", { className: "mccal-hint", children: (event.permissionPreset ?? "none") === "bypass" ? "The run's chat skips every permission prompt: it acts unattended without asking." : "The run's chat follows the agent CLI's own permission settings." }) : null,
          event.kind === "task" && isNew && !event.source ? /* @__PURE__ */ jsx2("div", { className: "mccal-field", children: /* @__PURE__ */ jsxs2("label", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 0 }, children: [
            /* @__PURE__ */ jsx2(
              "input",
              {
                type: "checkbox",
                style: { width: "auto" },
                checked: addToBacklog,
                disabled: !canSchedule,
                onChange: (changeEvent) => setAddToBacklog(changeEvent.target.checked)
              }
            ),
            "Also create a Backlog item",
            !canSchedule ? " (needs a known workspace folder)" : ""
          ] }) }) : null,
          /* @__PURE__ */ jsxs2("div", { className: "mccal-field", children: [
            /* @__PURE__ */ jsx2("label", { htmlFor: "mccal-desc", children: "Description" }),
            /* @__PURE__ */ jsx2(
              "textarea",
              {
                id: "mccal-desc",
                rows: 2,
                value: event.description ?? "",
                onChange: (changeEvent) => patch({ description: changeEvent.target.value || void 0 })
              }
            )
          ] }),
          scheduleBlocked ? /* @__PURE__ */ jsx2("div", { className: "mccal-error", children: "Can't schedule a run here: this workspace has no folder for the run's agent to work in." }) : null,
          error ? /* @__PURE__ */ jsx2("div", { className: "mccal-error", children: error }) : null,
          /* @__PURE__ */ jsxs2("div", { className: "mccal-ed-foot", children: [
            !isNew ? /* @__PURE__ */ jsx2("button", { type: "button", className: "mccal-btn mccal-danger", onClick: () => onDelete(event), children: "Delete" }) : null,
            /* @__PURE__ */ jsx2("span", { className: "mccal-spacer" }),
            /* @__PURE__ */ jsx2("button", { type: "button", className: "mccal-btn", onClick: onClose, children: "Cancel" }),
            /* @__PURE__ */ jsx2(
              "button",
              {
                type: "button",
                className: "mccal-btn mccal-primary",
                disabled: event.title.trim().length === 0 || scheduleBlocked,
                onClick: () => onSave(
                  { ...event, title: event.title.trim() },
                  addToBacklog && event.kind === "task" ? { addToBacklog: true } : void 0
                ),
                children: runsAtStart ? "Save & schedule" : "Save"
              }
            )
          ] })
        ] })
      ]
    }
  ) });
}

// src/ui/MonthView.tsx
import { useMemo as useMemo2 } from "react";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var MAX_CHIPS = 3;
function MonthView({ focusDate, events, now, onOpenDay, onOpen }) {
  const cells = useMemo2(() => {
    const first = startOfWeek(startOfMonth(focusDate));
    return Array.from({ length: 42 }, (_, i) => addDays(first, i));
  }, [focusDate]);
  const byDay = useMemo2(() => {
    const map = /* @__PURE__ */ new Map();
    for (const event of events) {
      const key = toDateKey(parseLocalDateTime(event.start));
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);
  return /* @__PURE__ */ jsxs3("div", { className: "mccal-month", children: [
    /* @__PURE__ */ jsx3("div", { className: "mccal-month-heads", children: DAY_LABELS.map((label) => /* @__PURE__ */ jsx3("div", { className: "mccal-month-head", children: label }, label)) }),
    /* @__PURE__ */ jsx3("div", { className: "mccal-month-grid", children: cells.map((day) => {
      const dayEvents = byDay.get(toDateKey(day)) ?? [];
      const outside = day.getMonth() !== focusDate.getMonth();
      return /* @__PURE__ */ jsxs3(
        "div",
        {
          className: [
            "mccal-mcell",
            outside ? "mccal-outside" : "",
            sameDay(day, now) ? "mccal-today" : ""
          ].filter(Boolean).join(" "),
          role: "button",
          tabIndex: 0,
          "aria-label": day.toDateString(),
          onClick: () => onOpenDay(day),
          onKeyDown: (event) => {
            if (event.key === "Enter") onOpenDay(day);
          },
          children: [
            /* @__PURE__ */ jsx3("span", { className: "mccal-mnum", children: day.getDate() }),
            dayEvents.slice(0, MAX_CHIPS).map((event) => /* @__PURE__ */ jsx3(
              "span",
              {
                className: `mccal-mchip mccal-${event.kind}`,
                onClick: (clickEvent) => {
                  clickEvent.stopPropagation();
                  onOpen(event);
                },
                children: event.title
              },
              event.id
            )),
            dayEvents.length > MAX_CHIPS ? /* @__PURE__ */ jsxs3("span", { className: "mccal-mmore", children: [
              "+",
              dayEvents.length - MAX_CHIPS,
              " more"
            ] }) : null
          ]
        },
        toDateKey(day)
      );
    }) })
  ] });
}

// src/ui/TimeGrid.tsx
import { useEffect as useEffect3, useMemo as useMemo3, useRef as useRef2, useState as useState3 } from "react";

// src/ui/layout.ts
function layoutDayEvents(events) {
  const sorted = [...events].sort(
    (a, b) => minutesOfDay(a.start) - minutesOfDay(b.start) || a.id.localeCompare(b.id)
  );
  const positioned = [];
  let cluster = [];
  let laneEnds = [];
  let clusterEnd = -1;
  const flush = () => {
    const laneCount = laneEnds.length;
    for (const p of cluster) p.laneCount = laneCount;
    cluster = [];
    laneEnds = [];
    clusterEnd = -1;
  };
  for (const event of sorted) {
    const startMin = minutesOfDay(event.start);
    const endMin = startMin + Math.max(15, event.durationMinutes);
    if (cluster.length > 0 && startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(endMin);
    } else {
      laneEnds[lane] = endMin;
    }
    const p = { event, startMin, endMin, lane, laneCount: 1 };
    cluster.push(p);
    positioned.push(p);
    clusterEnd = Math.max(clusterEnd, endMin);
  }
  flush();
  return positioned;
}

// src/ui/TimeGrid.tsx
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
var HOUR_HEIGHT = 48;
var SNAP_MINUTES = 15;
var DEFAULT_SCROLL_HOUR = 7;
var CALENDAR_DROP_MIME = "application/x-sprintengine-calendar-drop";
function snap(minutes) {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}
function clampMin(minutes) {
  return Math.max(0, Math.min(24 * 60 - SNAP_MINUTES, minutes));
}
function timeLabel(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${pad2(h)}:${pad2(m)}`;
}
function eventTimeLabel(event) {
  const startMin = minutesOfDay(event.start);
  if (event.kind === "automation") {
    return `runs at ${timeLabel(startMin)}`;
  }
  return `${timeLabel(startMin)} \u2013 ${timeLabel(Math.min(24 * 60, startMin + event.durationMinutes))}`;
}
function TimeGrid({
  days,
  events,
  now,
  onCreateRange,
  onMove,
  onResize,
  onOpen,
  onDelete,
  onExternalDrop
}) {
  const scrollRef = useRef2(null);
  const gridRef = useRef2(null);
  const [drag, setDrag] = useState3(null);
  const [dropHoverDay, setDropHoverDay] = useState3(null);
  useEffect3(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = DEFAULT_SCROLL_HOUR * HOUR_HEIGHT;
  }, []);
  const eventsByDay = useMemo3(() => {
    return days.map((day) => {
      const timed = events.filter(
        (event) => !event.allDay && sameDay(parseLocalDateTime(event.start), day)
      );
      return layoutDayEvents(timed);
    });
  }, [days, events]);
  const allDayByDay = useMemo3(
    () => days.map(
      (day) => events.filter((event) => event.allDay && sameDay(parseLocalDateTime(event.start), day))
    ),
    [days, events]
  );
  const columns = `54px repeat(${days.length}, 1fr)`;
  function pointToSlot(clientX, clientY) {
    const grid = gridRef.current;
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    const x = clientX - rect.left - 54;
    const colWidth = (rect.width - 54) / days.length;
    const dayIndex = Math.max(0, Math.min(days.length - 1, Math.floor(x / colWidth)));
    const minutes = clampMin(snap((clientY - rect.top) / HOUR_HEIGHT * 60));
    return { dayIndex, minutes };
  }
  function startAt(dayIndex, minutes) {
    const day = days[dayIndex];
    const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes);
    return toLocalDateTime(d);
  }
  function handleColumnPointerDown(event, dayIndex) {
    if (event.button !== 0) return;
    const slot = pointToSlot(event.clientX, event.clientY);
    if (!slot) return;
    event.target.setPointerCapture?.(event.pointerId);
    setDrag({ mode: "create", dayIndex, anchorMin: slot.minutes, currentMin: slot.minutes + 30 });
  }
  function handleEventPointerDown(event, calEvent) {
    if (event.button !== 0) return;
    event.stopPropagation();
    const slot = pointToSlot(event.clientX, event.clientY);
    if (!slot) return;
    const startMin = minutesOfDay(calEvent.start);
    event.target.setPointerCapture?.(event.pointerId);
    setDrag({
      mode: "move",
      eventId: calEvent.id,
      grabOffsetMin: slot.minutes - startMin,
      dayIndex: slot.dayIndex,
      currentMin: startMin,
      durationMinutes: calEvent.durationMinutes
    });
  }
  function handleResizePointerDown(event, calEvent, dayIndex) {
    if (event.button !== 0) return;
    event.stopPropagation();
    const startMin = minutesOfDay(calEvent.start);
    event.target.setPointerCapture?.(event.pointerId);
    setDrag({
      mode: "resize",
      eventId: calEvent.id,
      dayIndex,
      startMin,
      currentEndMin: startMin + calEvent.durationMinutes
    });
  }
  function handlePointerMove(event) {
    if (!drag) return;
    const slot = pointToSlot(event.clientX, event.clientY);
    if (!slot) return;
    if (drag.mode === "create") {
      setDrag({ ...drag, dayIndex: slot.dayIndex, currentMin: slot.minutes });
    } else if (drag.mode === "move") {
      setDrag({ ...drag, dayIndex: slot.dayIndex, currentMin: clampMin(slot.minutes - drag.grabOffsetMin) });
    } else {
      setDrag({ ...drag, currentEndMin: Math.max(drag.startMin + SNAP_MINUTES, slot.minutes) });
    }
  }
  function handlePointerUp() {
    if (!drag) return;
    if (drag.mode === "create") {
      const startMin = Math.min(drag.anchorMin, drag.currentMin);
      const endMin = Math.max(drag.anchorMin, drag.currentMin, startMin + SNAP_MINUTES);
      const duration = endMin - startMin < SNAP_MINUTES ? 30 : endMin - startMin;
      onCreateRange(startAt(drag.dayIndex, startMin), duration);
    } else if (drag.mode === "move") {
      onMove(drag.eventId, startAt(drag.dayIndex, drag.currentMin));
    } else {
      onResize(drag.eventId, drag.currentEndMin - drag.startMin);
    }
    setDrag(null);
  }
  function handleDragOver(event, dayIndex) {
    const types = Array.from(event.dataTransfer.types);
    if (hasFileDropData(event.dataTransfer) || types.includes(CALENDAR_DROP_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setDropHoverDay(dayIndex);
    }
  }
  function handleDrop(event) {
    event.preventDefault();
    setDropHoverDay(null);
    const slot = pointToSlot(event.clientX, event.clientY);
    if (!slot) return;
    onExternalDrop(event.dataTransfer, { start: startAt(slot.dayIndex, slot.minutes) });
  }
  function handleEventKeyDown(event, calEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(calEvent);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onDelete?.(calEvent);
    }
  }
  const totalHeight = 24 * HOUR_HEIGHT;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return /* @__PURE__ */ jsxs4("div", { className: "mccal-gridwrap", children: [
    /* @__PURE__ */ jsxs4("div", { className: "mccal-heads", style: { gridTemplateColumns: columns }, children: [
      /* @__PURE__ */ jsx4("div", { className: "mccal-head mccal-gutterhead", children: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      days.map((day, i) => /* @__PURE__ */ jsxs4("div", { className: `mccal-head${sameDay(day, now) ? " mccal-today" : ""}`, children: [
        day.toLocaleDateString(void 0, { weekday: "short" }),
        /* @__PURE__ */ jsx4("span", { className: "mccal-dom", children: day.getDate() })
      ] }, i))
    ] }),
    /* @__PURE__ */ jsxs4("div", { className: "mccal-allday-row", style: { gridTemplateColumns: columns }, children: [
      /* @__PURE__ */ jsx4("div", { className: "mccal-allday-cell mccal-gutter-cell", children: "all-day" }),
      days.map((_day, i) => /* @__PURE__ */ jsx4("div", { className: "mccal-allday-cell", children: allDayByDay[i].map((event) => /* @__PURE__ */ jsx4(
        "span",
        {
          className: `mccal-mchip mccal-${event.kind}`,
          role: "button",
          tabIndex: 0,
          onClick: () => onOpen(event),
          onKeyDown: (keyEvent) => handleEventKeyDown(keyEvent, event),
          children: event.title
        },
        event.id
      )) }, i))
    ] }),
    /* @__PURE__ */ jsx4("div", { className: "mccal-scroll", ref: scrollRef, children: /* @__PURE__ */ jsxs4(
      "div",
      {
        className: "mccal-grid",
        ref: gridRef,
        style: { gridTemplateColumns: columns, height: totalHeight },
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        children: [
          /* @__PURE__ */ jsx4("div", { className: "mccal-gutter", children: Array.from({ length: 24 }, (_, hour) => /* @__PURE__ */ jsx4("div", { className: "mccal-hourlab", style: { top: hour * HOUR_HEIGHT }, children: hour === 0 ? "" : timeLabel(hour * 60) }, hour)) }),
          days.map((day, dayIndex) => {
            const isToday = sameDay(day, now);
            return /* @__PURE__ */ jsxs4(
              "div",
              {
                className: [
                  "mccal-daycol",
                  isToday ? "mccal-today-col" : "",
                  dropHoverDay === dayIndex ? "mccal-drophover" : ""
                ].filter(Boolean).join(" "),
                onPointerDown: (event) => handleColumnPointerDown(event, dayIndex),
                onDragOver: (event) => handleDragOver(event, dayIndex),
                onDragLeave: () => setDropHoverDay((current) => current === dayIndex ? null : current),
                onDrop: handleDrop,
                children: [
                  Array.from({ length: 24 }, (_, hour) => /* @__PURE__ */ jsxs4("div", { children: [
                    /* @__PURE__ */ jsx4("div", { className: "mccal-hline", style: { top: hour * HOUR_HEIGHT } }),
                    /* @__PURE__ */ jsx4("div", { className: "mccal-hline mccal-half", style: { top: hour * HOUR_HEIGHT + HOUR_HEIGHT / 2 } })
                  ] }, hour)),
                  eventsByDay[dayIndex].map(({ event, startMin, endMin, lane, laneCount }) => {
                    const isDraggingThis = drag?.mode === "move" && drag.eventId === event.id;
                    const isResizingThis = drag?.mode === "resize" && drag.eventId === event.id;
                    const top = startMin / 60 * HOUR_HEIGHT;
                    const height = Math.max(18, (endMin - startMin) / 60 * HOUR_HEIGHT - 2);
                    const width = 100 / laneCount;
                    return /* @__PURE__ */ jsxs4(
                      "div",
                      {
                        role: "button",
                        tabIndex: 0,
                        "aria-label": `${event.title}, ${event.kind}, ${eventTimeLabel(event)}`,
                        className: [
                          "mccal-ev",
                          `mccal-${event.kind}`,
                          event.source ? "mccal-from-backlog" : "",
                          isDraggingThis || isResizingThis ? "mccal-dragging" : ""
                        ].filter(Boolean).join(" "),
                        style: {
                          top,
                          height: isResizingThis && drag?.mode === "resize" ? Math.max(18, (drag.currentEndMin - startMin) / 60 * HOUR_HEIGHT - 2) : height,
                          left: `calc(${lane * width}% + 1px)`,
                          width: `calc(${width}% - 3px)`
                        },
                        onPointerDown: (pointerEvent) => handleEventPointerDown(pointerEvent, event),
                        onKeyDown: (keyEvent) => handleEventKeyDown(keyEvent, event),
                        onDoubleClick: () => onOpen(event),
                        onClick: (clickEvent) => {
                          if (!drag) {
                            clickEvent.stopPropagation();
                            onOpen(event);
                          }
                        },
                        children: [
                          /* @__PURE__ */ jsxs4("span", { className: "mccal-ev-title", children: [
                            event.source?.displayId ? /* @__PURE__ */ jsxs4("span", { className: "mccal-ev-src", children: [
                              event.source.displayId,
                              " "
                            ] }) : null,
                            event.title
                          ] }),
                          (endMin - startMin) / 60 * HOUR_HEIGHT >= 34 ? /* @__PURE__ */ jsx4("span", { className: "mccal-ev-time", children: eventTimeLabel(event) }) : null,
                          (event.kind === "note" || event.kind === "task") && !isDraggingThis ? /* @__PURE__ */ jsx4(
                            "div",
                            {
                              className: "mccal-resize",
                              onPointerDown: (pointerEvent) => handleResizePointerDown(pointerEvent, event, dayIndex)
                            }
                          ) : null
                        ]
                      },
                      event.id
                    );
                  }),
                  drag?.mode === "create" && drag.dayIndex === dayIndex ? /* @__PURE__ */ jsx4(
                    "div",
                    {
                      className: "mccal-ghost",
                      style: {
                        top: Math.min(drag.anchorMin, drag.currentMin) / 60 * HOUR_HEIGHT,
                        height: Math.max(
                          SNAP_MINUTES / 60 * HOUR_HEIGHT,
                          Math.abs(drag.currentMin - drag.anchorMin) / 60 * HOUR_HEIGHT
                        ),
                        left: 1,
                        right: 2
                      }
                    }
                  ) : null,
                  drag?.mode === "move" && drag.dayIndex === dayIndex ? /* @__PURE__ */ jsx4(
                    "div",
                    {
                      className: "mccal-ghost",
                      style: {
                        top: drag.currentMin / 60 * HOUR_HEIGHT,
                        height: drag.durationMinutes / 60 * HOUR_HEIGHT,
                        left: 1,
                        right: 2
                      }
                    }
                  ) : null,
                  isToday ? /* @__PURE__ */ jsx4("div", { className: "mccal-nowline", style: { top: nowMin / 60 * HOUR_HEIGHT }, children: /* @__PURE__ */ jsx4("span", { className: "mccal-bead" }) }) : null
                ]
              },
              toDateKey(day)
            );
          })
        ]
      }
    ) })
  ] });
}

// src/ui/PlanningRail.tsx
import { Fragment, jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
function tagClass(type) {
  if (type === "feature") return "mccal-tag mccal-tag-feature";
  if (type === "bug") return "mccal-tag mccal-tag-bug";
  return "mccal-tag";
}
function PlanningRail({
  backlogItems,
  backlogUnavailable,
  unscheduledTasks,
  scheduledPaths,
  displayIds,
  workspaceRoot,
  onOpenTask
}) {
  const openItems = (backlogItems ?? []).filter(
    (item) => item.status !== "completed" && item.status !== "archived" && item.type !== "epic" && !scheduledPaths.has(item.path)
  );
  function handleBacklogDragStart(event, item) {
    if (!event.dataTransfer) return;
    const payload = {
      kind: "rail-backlog",
      path: item.path,
      title: item.title,
      ...displayIds.get(item.path) ? { displayId: displayIds.get(item.path) } : {}
    };
    event.dataTransfer.setData(CALENDAR_DROP_MIME, JSON.stringify(payload));
    setFileDropData(event.dataTransfer, {
      version: 1,
      workspaceId: null,
      rootPath: workspaceRoot ?? "",
      files: [{ path: item.path, name: item.relativePath.split("/").pop() ?? item.relativePath }]
    });
  }
  function handleTaskDragStart(event, task) {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData(
      CALENDAR_DROP_MIME,
      JSON.stringify({ kind: "rail-task", eventId: task.id })
    );
    event.dataTransfer.effectAllowed = "move";
  }
  return /* @__PURE__ */ jsxs5("aside", { className: "mccal-rail", "aria-label": "Planning rail", children: [
    /* @__PURE__ */ jsxs5("div", { className: "mccal-rail-head", children: [
      /* @__PURE__ */ jsx5("span", { className: "mccal-rt", children: "Plan" }),
      /* @__PURE__ */ jsx5("span", { className: "mccal-rc", children: backlogItems === null && !backlogUnavailable ? "\u2026" : `${openItems.length} open` })
    ] }),
    /* @__PURE__ */ jsxs5("div", { className: "mccal-rail-body", children: [
      /* @__PURE__ */ jsx5("div", { className: "mccal-rail-sect", children: "Backlog" }),
      backlogUnavailable ? /* @__PURE__ */ jsx5("div", { className: "mccal-rail-empty", children: "Backlog unavailable in this workspace." }) : backlogItems === null ? /* @__PURE__ */ jsx5("div", { className: "mccal-rail-empty", children: "Loading Backlog\u2026" }) : openItems.length === 0 ? /* @__PURE__ */ jsx5("div", { className: "mccal-rail-empty", children: "Nothing unscheduled. Drag items here from the Backlog panel." }) : openItems.map((item) => /* @__PURE__ */ jsxs5(
        "div",
        {
          className: "mccal-card",
          draggable: true,
          tabIndex: 0,
          "aria-label": `Backlog item: ${item.title}. Drag onto the grid to schedule.`,
          onDragStart: (event) => handleBacklogDragStart(event, item),
          children: [
            /* @__PURE__ */ jsx5("span", { className: "mccal-card-title", children: item.title }),
            /* @__PURE__ */ jsxs5("span", { className: "mccal-card-meta", children: [
              displayIds.get(item.path) ? /* @__PURE__ */ jsx5("span", { className: "mccal-card-id", children: displayIds.get(item.path) }) : null,
              item.type ? /* @__PURE__ */ jsx5("span", { className: tagClass(item.type), children: item.type }) : null
            ] })
          ]
        },
        item.id
      )),
      unscheduledTasks.length > 0 ? /* @__PURE__ */ jsxs5(Fragment, { children: [
        /* @__PURE__ */ jsx5("div", { className: "mccal-rail-sect", children: "Tasks" }),
        unscheduledTasks.map((task) => /* @__PURE__ */ jsx5(
          "div",
          {
            className: "mccal-card",
            draggable: true,
            tabIndex: 0,
            "aria-label": `Task: ${task.title}. Drag onto the grid to time-block.`,
            onDragStart: (event) => handleTaskDragStart(event, task),
            onClick: () => onOpenTask(task),
            children: /* @__PURE__ */ jsx5("span", { className: "mccal-card-title", children: task.title })
          },
          task.id
        ))
      ] }) : null
    ] })
  ] });
}

// src/ui/CalendarPanel.tsx
import { jsx as jsx6, jsxs as jsxs6 } from "react/jsx-runtime";
function newId() {
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function deriveDisplayId(item, key) {
  const match = /^---\n[\s\S]*?\bid:\s*(\d+)\s*$/m.exec(item.sourceContent.slice(0, 2e3));
  return match ? `${key}-${match[1]}` : void 0;
}
function CalendarPanel({ workspaceId, host, initialView }) {
  const [view, setView] = useState4(initialView);
  const [focusDate, setFocusDate] = useState4(() => /* @__PURE__ */ new Date());
  const [now, setNow] = useState4(() => /* @__PURE__ */ new Date());
  const [events, setEvents] = useState4(null);
  const [backlogItems, setBacklogItems] = useState4(null);
  const [backlogUnavailable, setBacklogUnavailable] = useState4(false);
  const [workspaceRoot, setWorkspaceRoot] = useState4(null);
  const [liveRuns, setLiveRuns] = useState4([]);
  const [runtimes, setRuntimes] = useState4([]);
  const [editor, setEditor] = useState4(null);
  const [editorError, setEditorError] = useState4(null);
  const [loadError, setLoadError] = useState4(null);
  const [cmdkOpen, setCmdkOpen] = useState4(false);
  const eventsRef = useRef3([]);
  useEffect4(() => {
    const timer = window.setInterval(() => setNow(/* @__PURE__ */ new Date()), 6e4);
    return () => window.clearInterval(timer);
  }, []);
  useEffect4(() => {
    let disposed = false;
    setEvents(null);
    setLoadError(null);
    host.invoke(CH_EVENTS_LOAD, { workspaceId }).then((response) => {
      if (disposed) return;
      const loaded = response.events;
      eventsRef.current = loaded;
      setEvents(loaded);
    }).catch((error) => {
      if (!disposed) setLoadError(error instanceof Error ? error.message : String(error));
    });
    return () => {
      disposed = true;
    };
  }, [host, workspaceId]);
  const persist = useCallback(
    (next) => {
      eventsRef.current = next;
      setEvents(next);
      void host.invoke(CH_EVENTS_SAVE, { workspaceId, events: next }).catch((error) => {
        setLoadError(`Save failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    },
    [host, workspaceId]
  );
  useEffect4(() => {
    let disposed = false;
    const read = () => {
      host.invoke(CH_RUNS).then((response) => {
        if (!disposed) setLiveRuns(response.runs);
      }).catch(() => {
      });
    };
    read();
    const off = host.subscribe(TOPIC_RUNS_CHANGED, read);
    return () => {
      disposed = true;
      off();
    };
  }, [host]);
  useEffect4(() => {
    if (host.supports("chat.open")) setRuntimes(host.listChatRuntimes());
  }, [host]);
  useEffect4(() => {
    let disposed = false;
    setWorkspaceRoot(null);
    void host.getWorkspace(workspaceId).then((view2) => {
      if (!disposed) setWorkspaceRoot(view2?.folderPath ?? null);
    });
    return () => {
      disposed = true;
    };
  }, [host, workspaceId]);
  useEffect4(() => {
    let disposed = false;
    setBacklogUnavailable(false);
    setBacklogItems(null);
    let off;
    try {
      off = host.watchBacklogItems(workspaceId, (items) => {
        if (disposed) return;
        setBacklogItems(items);
      });
    } catch {
      setBacklogUnavailable(true);
    }
    return () => {
      disposed = true;
      off?.();
    };
  }, [host, workspaceId]);
  const displayIds = useMemo4(() => {
    const map = /* @__PURE__ */ new Map();
    for (const item of backlogItems ?? []) {
      const id = deriveDisplayId(item, "MC");
      if (id) map.set(item.path, id);
    }
    return map;
  }, [backlogItems]);
  const scheduledPaths = useMemo4(() => {
    const set = /* @__PURE__ */ new Set();
    for (const event of events ?? []) {
      if (event.source) set.add(event.source.path);
    }
    return set;
  }, [events]);
  const unscheduledTasks = useMemo4(
    () => (events ?? []).filter((event) => event.kind === "task" && event.unscheduled),
    [events]
  );
  const scheduleIfNeeded = useCallback(
    async (event, previous) => {
      const runsAtStart = event.kind === "automation" && !event.unscheduled;
      if (previous?.automationId) {
        await host.invoke(CH_UNSCHEDULE, { workspaceId, automationId: previous.automationId }).catch(() => void 0);
      }
      if (!runsAtStart) return { ...event, automationId: void 0 };
      const response = await host.invoke(CH_SCHEDULE, {
        workspaceId,
        event
      });
      if (!response.ok) throw new Error(`${response.code}: ${response.message}`);
      return { ...event, automationId: response.automationId };
    },
    [host, workspaceId]
  );
  const upsert = useCallback(
    async (event) => {
      const previous = eventsRef.current.find((candidate) => candidate.id === event.id);
      const finalEvent = await scheduleIfNeeded(
        { ...event, updatedAt: toLocalDateTime(/* @__PURE__ */ new Date()) },
        previous
      );
      const rest = eventsRef.current.filter((candidate) => candidate.id !== event.id);
      persist([...rest, finalEvent]);
    },
    [persist, scheduleIfNeeded]
  );
  const handleSave = useCallback(
    (event, options) => {
      setEditorError(null);
      const prepare = options?.addToBacklog ? host.invoke(CH_CREATE_BACKLOG_ITEM, {
        workspaceId,
        title: event.title,
        description: event.description
      }).then((response) => {
        const { path } = response;
        return { ...event, source: { path, title: event.title } };
      }) : Promise.resolve(event);
      prepare.then((prepared) => upsert(prepared)).then(() => setEditor(null)).catch(
        (error) => setEditorError(error instanceof Error ? error.message : String(error))
      );
    },
    [host, upsert, workspaceId]
  );
  const handleDelete = useCallback(
    (event) => {
      if (event.automationId) {
        void host.invoke(CH_UNSCHEDULE, { workspaceId, automationId: event.automationId }).catch(() => void 0);
      }
      persist(eventsRef.current.filter((candidate) => candidate.id !== event.id));
      setEditor(null);
    },
    [host, persist, workspaceId]
  );
  const handleMove = useCallback(
    (eventId, newStart) => {
      const current = eventsRef.current.find((candidate) => candidate.id === eventId);
      if (!current || current.start === newStart) return;
      upsert({ ...current, start: newStart }).catch(
        (error) => setLoadError(error instanceof Error ? error.message : String(error))
      );
    },
    [upsert]
  );
  const handleResize = useCallback(
    (eventId, durationMinutes) => {
      const current = eventsRef.current.find((candidate) => candidate.id === eventId);
      if (!current || current.durationMinutes === durationMinutes) return;
      upsert({ ...current, durationMinutes }).catch(
        (error) => setLoadError(error instanceof Error ? error.message : String(error))
      );
    },
    [upsert]
  );
  const openNewEditor = useCallback((partial) => {
    const stamp = toLocalDateTime(/* @__PURE__ */ new Date());
    setEditorError(null);
    setEditor({
      isNew: true,
      draft: {
        id: newId(),
        title: "",
        kind: "note",
        start: toLocalDateTime(/* @__PURE__ */ new Date()),
        durationMinutes: 30,
        createdAt: stamp,
        updatedAt: stamp,
        ...partial
      }
    });
  }, []);
  const handleCreateRange = useCallback(
    (start, durationMinutes) => {
      openNewEditor({ start, durationMinutes });
    },
    [openNewEditor]
  );
  const handleExternalDrop = useCallback(
    (dataTransfer, target) => {
      const filePayload = readFileDropPayload(dataTransfer);
      if (filePayload) {
        const file = filePayload.files[0];
        const matching = (backlogItems ?? []).find((item) => item.path === file.path);
        openNewEditor({
          kind: "automation",
          start: target.start,
          durationMinutes: 30,
          title: matching?.title ?? file.name.replace(/\.md$/, ""),
          source: {
            path: file.path,
            title: matching?.title,
            displayId: displayIds.get(file.path)
          }
        });
        return;
      }
      const raw = dataTransfer.getData(CALENDAR_DROP_MIME);
      if (!raw) return;
      try {
        const payload = JSON.parse(raw);
        if (payload.kind === "rail-backlog") {
          openNewEditor({
            kind: "automation",
            start: target.start,
            durationMinutes: 30,
            title: payload.title,
            source: {
              path: payload.path,
              title: payload.title,
              displayId: payload.displayId ?? displayIds.get(payload.path)
            }
          });
        } else if (payload.kind === "rail-task") {
          const task = eventsRef.current.find((candidate) => candidate.id === payload.eventId);
          if (task) {
            upsert({ ...task, start: target.start, unscheduled: void 0 }).catch(
              (error) => setLoadError(error instanceof Error ? error.message : String(error))
            );
          }
        }
      } catch {
      }
    },
    [backlogItems, displayIds, openNewEditor, upsert]
  );
  useEffect4(() => {
    const offSchedule = onBusEvent(SCHEDULE_REQUEST_EVENT, (detail) => {
      if (detail.workspaceId !== workspaceId) return;
      detail.claim();
      const nextHour = /* @__PURE__ */ new Date();
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      openNewEditor({
        kind: "automation",
        start: toLocalDateTime(nextHour),
        durationMinutes: 30,
        title: detail.title,
        source: { path: detail.path, title: detail.title, displayId: detail.displayId }
      });
    });
    const offReveal = onBusEvent(REVEAL_EVENT, (detail) => {
      if (detail.workspaceId !== workspaceId) return;
      const event = eventsRef.current.find((candidate) => candidate.id === detail.eventId);
      if (!event) return;
      detail.claim();
      setFocusDate(parseLocalDateTime(event.start));
      setEditorError(null);
      setEditor({ draft: event, isNew: false });
    });
    const offNew = onBusEvent(NEW_EVENT_REQUEST, (detail) => {
      ;
      detail.claim();
      openNewEditor({});
    });
    const offPlan = onBusEvent(PLAN_DAY_REQUEST, (detail) => {
      ;
      detail.claim();
      planMyDay();
    });
    return () => {
      offSchedule();
      offReveal();
      offNew();
      offPlan();
    };
  });
  function planMyDay() {
    const day = /* @__PURE__ */ new Date();
    const taskCandidates = unscheduledTasks.map((task) => ({
      key: `task:${task.id}`,
      durationMinutes: task.durationMinutes || 30
    }));
    const railItems = (backlogItems ?? []).filter(
      (item) => item.status !== "completed" && item.status !== "archived" && item.type !== "epic" && !scheduledPaths.has(item.path)
    ).slice(0, 3);
    const itemCandidates = railItems.map((item) => ({ key: `item:${item.path}`, durationMinutes: 45 }));
    const placements = planDay(day, events ?? [], [...taskCandidates, ...itemCandidates], /* @__PURE__ */ new Date());
    if (placements.length === 0) return;
    const stamp = toLocalDateTime(/* @__PURE__ */ new Date());
    let next = [...eventsRef.current];
    for (const placement of placements) {
      if (placement.key.startsWith("task:")) {
        const id = placement.key.slice(5);
        next = next.map(
          (candidate) => candidate.id === id ? { ...candidate, start: placement.start, unscheduled: void 0, updatedAt: stamp } : candidate
        );
      } else {
        const path = placement.key.slice(5);
        const item = railItems.find((candidate) => candidate.path === path);
        if (!item) continue;
        next.push({
          id: newId(),
          title: item.title,
          kind: "task",
          start: placement.start,
          durationMinutes: 45,
          source: { path: item.path, title: item.title, displayId: displayIds.get(item.path) },
          createdAt: stamp,
          updatedAt: stamp
        });
      }
    }
    persist(next);
  }
  const commandActions = [
    { id: "new", label: "New event", run: () => openNewEditor({}) },
    { id: "today", label: "Go to today", run: () => setFocusDate(/* @__PURE__ */ new Date()) },
    { id: "tomorrow", label: "Jump to tomorrow", run: () => setFocusDate(addDays(/* @__PURE__ */ new Date(), 1)) },
    { id: "day", label: "Day view", run: () => setView("day") },
    { id: "week", label: "Week view", run: () => setView("week") },
    { id: "month", label: "Month view", run: () => setView("month") },
    { id: "plan", label: "Plan my day (auto-schedule)", hint: "Time-block unscheduled work into free slots today", run: () => planMyDay() },
    ...host.supports("chat.open") ? [
      {
        id: "run-day-plan",
        label: "Run day plan in a chat",
        hint: "Opens a chat that works today's scheduled events",
        run: () => {
          const today = toDateKey(/* @__PURE__ */ new Date());
          const todaysEvents = (events ?? []).filter((event) => event.start.startsWith(today));
          const lines = todaysEvents.length > 0 ? todaysEvents.map((event) => `- ${event.start.slice(11, 16)} ${event.title}`).join("\n") : "- (no events scheduled today)";
          void host.openChat({
            workspaceId,
            prompt: `You are working from this workspace's calendar. Today's schedule:
${lines}

Review the schedule and start on the first actionable item.`,
            send: true
          }).then((result) => {
            if (!result.ok) setLoadError(`Could not open the day-plan chat (${result.code}): ${result.message}`);
          });
        }
      }
    ] : [],
    ...(backlogItems ?? []).filter((item) => item.status !== "completed" && item.status !== "archived" && item.type !== "epic" && !scheduledPaths.has(item.path)).slice(0, 8).map((item) => ({
      id: `schedule:${item.path}`,
      label: `Schedule: ${item.title}`,
      hint: displayIds.get(item.path),
      run: () => {
        const nextHour = /* @__PURE__ */ new Date();
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        openNewEditor({
          kind: "automation",
          start: toLocalDateTime(nextHour),
          durationMinutes: 30,
          title: item.title,
          source: { path: item.path, title: item.title, displayId: displayIds.get(item.path) }
        });
      }
    }))
  ];
  const days = useMemo4(() => {
    if (view === "day") return [focusDate];
    const weekStart = startOfWeek(focusDate);
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [view, focusDate]);
  const gridEvents = useMemo4(() => {
    const visible = (events ?? []).filter((event) => !event.unscheduled);
    return expandEvents(visible, days).map((display) => ({ ...display.event, start: display.start }));
  }, [events, days]);
  const monthEvents = useMemo4(() => {
    if (view !== "month") return [];
    const visible = (events ?? []).filter((event) => !event.unscheduled);
    const cells = monthGridDays(startOfWeek(startOfMonth(focusDate)));
    return expandEvents(visible, cells).map((display) => ({ ...display.event, start: display.start }));
  }, [events, view, focusDate]);
  const title = view === "month" ? monthTitle(focusDate) : view === "day" ? dayTitle(focusDate) : weekTitle(startOfWeek(focusDate));
  function navigate(direction) {
    const step = view === "month" ? 0 : view === "day" ? 1 : 7;
    if (view === "month") {
      setFocusDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
    } else {
      setFocusDate((current) => addDays(current, step * direction));
    }
  }
  return /* @__PURE__ */ jsxs6(
    "div",
    {
      className: "mccal-root",
      onKeyDown: (keyEvent) => {
        if ((keyEvent.metaKey || keyEvent.ctrlKey) && keyEvent.key.toLowerCase() === "k") {
          keyEvent.preventDefault();
          keyEvent.stopPropagation();
          setCmdkOpen(true);
        }
      },
      children: [
        /* @__PURE__ */ jsxs6("div", { className: "mccal-bar", children: [
          /* @__PURE__ */ jsx6("span", { className: "mccal-title", children: title }),
          liveRuns.length > 0 ? /* @__PURE__ */ jsxs6(
            "button",
            {
              type: "button",
              className: "mccal-live",
              title: `Scheduled runs working: ${liveRuns.map((run) => run.name).join(", ")} \u2014 open the first`,
              onClick: () => {
                const [first] = liveRuns;
                if (!first) return;
                try {
                  host.focusTab({ workspaceId: first.workspaceId, kind: "chat", id: first.agentId });
                } catch {
                }
              },
              children: [
                liveRuns.length,
                " run",
                liveRuns.length === 1 ? "" : "s",
                " working"
              ]
            }
          ) : null,
          /* @__PURE__ */ jsx6("button", { type: "button", className: "mccal-btn", onClick: () => navigate(-1), "aria-label": "Previous", children: "\u2039" }),
          /* @__PURE__ */ jsx6("button", { type: "button", className: "mccal-btn", onClick: () => setFocusDate(/* @__PURE__ */ new Date()), children: "Today" }),
          /* @__PURE__ */ jsx6("button", { type: "button", className: "mccal-btn", onClick: () => navigate(1), "aria-label": "Next", children: "\u203A" }),
          /* @__PURE__ */ jsx6(
            "input",
            {
              type: "date",
              className: "mccal-btn",
              style: { width: 130 },
              "aria-label": "Jump to date",
              value: toDateKey(focusDate),
              onChange: (changeEvent) => {
                if (changeEvent.target.value) setFocusDate(parseLocalDateTime(`${changeEvent.target.value}T00:00`));
              }
            }
          ),
          /* @__PURE__ */ jsx6("span", { className: "mccal-bar-spacer" }),
          /* @__PURE__ */ jsx6("div", { className: "mccal-viewgroup", role: "radiogroup", "aria-label": "Calendar view", children: ["day", "week", "month"].map((candidate) => /* @__PURE__ */ jsx6(
            "button",
            {
              type: "button",
              className: "mccal-btn",
              "aria-pressed": view === candidate,
              onClick: () => setView(candidate),
              children: candidate[0].toUpperCase() + candidate.slice(1)
            },
            candidate
          )) }),
          /* @__PURE__ */ jsx6(
            "button",
            {
              type: "button",
              className: "mccal-btn",
              onClick: () => setCmdkOpen(true),
              "aria-label": "Open calendar commands",
              children: /* @__PURE__ */ jsx6("span", { className: "mccal-kbd", children: "\u2318K" })
            }
          ),
          /* @__PURE__ */ jsx6("button", { type: "button", className: "mccal-btn mccal-primary", onClick: () => openNewEditor({}), children: "New event" })
        ] }),
        loadError ? /* @__PURE__ */ jsx6("div", { className: "mccal-error", role: "alert", style: { padding: "4px 10px" }, children: loadError }) : null,
        /* @__PURE__ */ jsxs6("div", { className: "mccal-body", style: { position: "relative" }, children: [
          view === "month" ? /* @__PURE__ */ jsx6(
            MonthView,
            {
              focusDate,
              events: monthEvents,
              now,
              onOpenDay: (day) => {
                setFocusDate(day);
                setView("day");
              },
              onOpen: (event) => {
                setEditorError(null);
                setEditor({ draft: event, isNew: false });
              }
            }
          ) : /* @__PURE__ */ jsx6(
            TimeGrid,
            {
              days,
              events: gridEvents,
              now,
              onCreateRange: handleCreateRange,
              onMove: handleMove,
              onResize: handleResize,
              onOpen: (event) => {
                setEditorError(null);
                setEditor({ draft: event, isNew: false });
              },
              onDelete: handleDelete,
              onExternalDrop: handleExternalDrop
            }
          ),
          /* @__PURE__ */ jsx6(
            PlanningRail,
            {
              backlogItems,
              backlogUnavailable,
              unscheduledTasks,
              scheduledPaths,
              displayIds,
              workspaceRoot,
              onOpenTask: (task) => {
                setEditorError(null);
                setEditor({ draft: task, isNew: false });
              }
            }
          ),
          editor ? /* @__PURE__ */ jsx6(
            EventEditor,
            {
              draft: editor.draft,
              isNew: editor.isNew,
              canSchedule: workspaceRoot !== null,
              runtimes,
              error: editorError,
              onSave: handleSave,
              onDelete: handleDelete,
              onClose: () => setEditor(null)
            }
          ) : null,
          cmdkOpen ? /* @__PURE__ */ jsx6(CommandBar, { actions: commandActions, onClose: () => setCmdkOpen(false) }) : null
        ] })
      ]
    }
  );
}

// src/ui/icons.tsx
import { jsx as jsx7, jsxs as jsxs7 } from "react/jsx-runtime";
function CalendarIcon({ className }) {
  return /* @__PURE__ */ jsxs7(
    "svg",
    {
      className,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.6",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsx7("rect", { x: "3.5", y: "5", width: "17", height: "15.5", rx: "2" }),
        /* @__PURE__ */ jsx7("path", { d: "M3.5 9.5h17" }),
        /* @__PURE__ */ jsx7("path", { d: "M8 3v3.5" }),
        /* @__PURE__ */ jsx7("path", { d: "M16 3v3.5" }),
        /* @__PURE__ */ jsx7("path", { d: "M7.5 13h3" }),
        /* @__PURE__ */ jsx7("path", { d: "M13.5 13h3" }),
        /* @__PURE__ */ jsx7("path", { d: "M7.5 16.5h3" })
      ]
    }
  );
}

// src/ui/styles.ts
var STYLE_ELEMENT_ID = "sprintengine-calendar-module-styles";
function injectStylesOnce() {
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}
var STYLES = (
  /* css */
  `
.mccal-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg-app);
  color: var(--text-default);
  font-variant-numeric: tabular-nums;
  --mccal-note: var(--tone-neutral);
  --mccal-task: var(--tone-accent);
  --mccal-automation: var(--tone-warn);
  --mccal-backlog: var(--tone-merged);
  --mccal-note-soft: color-mix(in srgb, var(--tone-neutral) 16%, transparent);
  --mccal-task-soft: color-mix(in srgb, var(--tone-accent) 15%, transparent);
  --mccal-automation-soft: color-mix(in srgb, var(--tone-warn) 15%, transparent);
  --mccal-backlog-soft: color-mix(in srgb, var(--tone-merged) 15%, transparent);
}

/* \u2500\u2500 Toolbar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.mccal-live {
  font-size: 11px;
  line-height: 16px;
  padding: 2px 8px;
  border-radius: 999px;
  color: var(--tone-ok, var(--text-muted));
  border: 1px solid var(--border-subtle);
  background: transparent;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
}

.mccal-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  flex: 0 0 auto;
  padding: 0 10px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-surface);
}
.mccal-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong);
  min-width: 150px;
}
.mccal-btn {
  appearance: none;
  border: 1px solid var(--border-default);
  background: var(--bg-surface-raised);
  color: var(--text-muted);
  font-size: 11.5px;
  height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.mccal-btn:hover { background: var(--bg-hover); color: var(--text-default); }
.mccal-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.mccal-btn[aria-pressed='true'] {
  background: var(--bg-selected);
  color: var(--text-strong);
  border-color: var(--border-strong);
}
.mccal-btn.mccal-primary {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: var(--text-on-accent);
}
.mccal-bar-spacer { flex: 1; }
.mccal-viewgroup { display: inline-flex; gap: 2px; }
.mccal-kbd {
  font-size: 10px;
  color: var(--text-subtle);
  background: var(--bg-hover);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  padding: 1px 5px;
}

/* \u2500\u2500 Body: grid + rail \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.mccal-body { flex: 1; display: flex; min-height: 0; }
.mccal-gridwrap { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }

/* Day-of-week header row */
.mccal-heads {
  display: grid;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-surface);
}
.mccal-head {
  padding: 6px 8px 4px;
  font-size: 11px;
  color: var(--text-muted);
  border-left: 1px solid var(--border-subtle);
  min-width: 0;
}
.mccal-head .mccal-dom { font-size: 15px; font-weight: 600; color: var(--text-strong); display: block; }
.mccal-head.mccal-today .mccal-dom { color: var(--accent-primary); }
.mccal-head.mccal-gutterhead { border-left: none; text-align: right; font-size: 9.5px; color: var(--text-disabled); align-self: end; padding-bottom: 4px; }

/* All-day row */
.mccal-allday-row { display: grid; flex: 0 0 auto; border-bottom: 1px solid var(--border-default); background: var(--bg-surface); }
.mccal-allday-cell { min-height: 24px; border-left: 1px solid var(--border-subtle); padding: 2px 3px; display: flex; flex-direction: column; gap: 2px; }
.mccal-allday-cell.mccal-gutter-cell { border-left: none; text-align: right; font-size: 9.5px; color: var(--text-disabled); justify-content: center; padding-right: 6px; }

/* Scrolling time grid */
.mccal-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; min-height: 0; background: var(--bg-app); }
.mccal-grid { display: grid; position: relative; }
.mccal-gutter { position: relative; }
.mccal-hourlab {
  position: absolute;
  right: 6px;
  transform: translateY(-6px);
  font-size: 10px;
  color: var(--text-subtle);
}
.mccal-daycol {
  position: relative;
  border-left: 1px solid var(--border-subtle);
  min-width: 0;
}
.mccal-daycol.mccal-today-col { background: color-mix(in srgb, var(--accent-primary) 3%, transparent); }
.mccal-hline { position: absolute; left: 0; right: 0; border-top: 1px solid var(--border-subtle); pointer-events: none; }
.mccal-hline.mccal-half { border-top-style: dotted; opacity: 0.6; }

/* Now line */
.mccal-nowline { position: absolute; left: 0; right: 0; border-top: 1.5px solid var(--accent-primary); z-index: 5; pointer-events: none; }
.mccal-nowline .mccal-bead {
  position: absolute; left: -4px; top: -4.5px; width: 8px; height: 8px;
  border-radius: 999px; background: var(--accent-primary);
}

/* Event blocks */
.mccal-ev {
  position: absolute;
  border-radius: 4px;
  border-left: 3px solid var(--mccal-note);
  background: var(--mccal-note-soft);
  padding: 2px 6px 2px 5px;
  font-size: 11px;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  z-index: 2;
}
.mccal-ev:focus-visible { outline: none; box-shadow: var(--focus-ring); z-index: 6; }
.mccal-ev .mccal-ev-title { color: var(--text-strong); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
.mccal-ev .mccal-ev-time { color: var(--text-muted); font-size: 10px; display: block; }
.mccal-ev .mccal-ev-src { color: var(--mccal-backlog); font-size: 9.5px; font-weight: 700; }
.mccal-ev.mccal-note { border-left-color: var(--mccal-note); background: var(--mccal-note-soft); }
.mccal-ev.mccal-task { border-left-color: var(--mccal-task); background: var(--mccal-task-soft); }
.mccal-ev.mccal-automation { border-left-color: var(--mccal-automation); background: var(--mccal-automation-soft); }
.mccal-ev.mccal-from-backlog { border-left-color: var(--mccal-backlog); }
.mccal-ev.mccal-dragging { opacity: 0.65; cursor: grabbing; z-index: 8; }
.mccal-resize {
  position: absolute; left: 0; right: 0; bottom: -2px; height: 6px;
  cursor: ns-resize;
}

/* Drag-create ghost + drop hover */
.mccal-ghost {
  position: absolute;
  border-radius: 4px;
  border: 1.5px dashed var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 10%, transparent);
  z-index: 7;
  pointer-events: none;
}
.mccal-daycol.mccal-drophover { background: var(--bg-selected); }

/* \u2500\u2500 Month view \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.mccal-month { flex: 1; display: grid; grid-template-rows: auto 1fr; min-height: 0; }
.mccal-month-heads { display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 1px solid var(--border-default); background: var(--bg-surface); }
.mccal-month-head { font-size: 10.5px; color: var(--text-subtle); text-transform: uppercase; letter-spacing: 0.04em; padding: 5px 8px; border-left: 1px solid var(--border-subtle); }
.mccal-month-grid { display: grid; grid-template-columns: repeat(7, 1fr); grid-auto-rows: 1fr; min-height: 0; }
.mccal-mcell { border-left: 1px solid var(--border-subtle); border-bottom: 1px solid var(--border-subtle); padding: 3px 4px; min-width: 0; overflow: hidden; cursor: pointer; }
.mccal-mcell:hover { background: var(--bg-hover); }
.mccal-mcell .mccal-mnum { font-size: 11px; color: var(--text-muted); }
.mccal-mcell.mccal-outside .mccal-mnum { color: var(--text-disabled); }
.mccal-mcell.mccal-today .mccal-mnum {
  color: var(--text-on-accent);
  background: var(--accent-primary);
  border-radius: 999px;
  display: inline-block;
  min-width: 18px;
  text-align: center;
}
.mccal-mchip {
  display: block; font-size: 10px; border-radius: 3px; padding: 0 4px; margin-top: 2px;
  border-left: 2px solid var(--mccal-note); background: var(--mccal-note-soft);
  color: var(--text-default); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mccal-mchip.mccal-task { border-left-color: var(--mccal-task); background: var(--mccal-task-soft); }
.mccal-mchip.mccal-automation { border-left-color: var(--mccal-automation); background: var(--mccal-automation-soft); }
.mccal-mmore { font-size: 9.5px; color: var(--text-subtle); }

/* \u2500\u2500 Planning rail \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.mccal-rail {
  width: 244px;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-app);
  border-left: 1px solid var(--border-subtle);
}
.mccal-rail-head {
  height: 36px; flex: 0 0 auto; display: flex; align-items: center; gap: 8px;
  padding: 0 12px; border-bottom: 1px solid var(--border-subtle);
}
.mccal-rail-head .mccal-rt { font-size: 12px; font-weight: 600; color: var(--text-strong); flex: 1; }
.mccal-rail-head .mccal-rc { font-size: 10px; color: var(--text-subtle); }
.mccal-rail-sect {
  font-size: 10px; font-weight: 600; color: var(--text-subtle);
  text-transform: uppercase; letter-spacing: 0.04em; padding: 10px 12px 4px;
}
.mccal-rail-body { flex: 1; overflow-y: auto; min-height: 0; padding: 0 8px 8px; }
.mccal-card {
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  border-radius: 6px;
  padding: 6px 8px;
  margin-top: 6px;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
}
.mccal-card:hover { background: var(--bg-hover); border-color: var(--border-default); }
.mccal-card:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.mccal-card .mccal-card-title {
  font-size: 11.5px; color: var(--text-default);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.mccal-card .mccal-card-meta { display: flex; gap: 6px; margin-top: 3px; align-items: center; }
.mccal-card .mccal-card-id { font-size: 9.5px; font-weight: 700; color: var(--mccal-backlog); }
.mccal-tag {
  font-size: 9px; border-radius: 3px; padding: 0 4px; text-transform: uppercase; letter-spacing: 0.03em;
  color: var(--tone-neutral); background: var(--mccal-note-soft);
}
.mccal-tag.mccal-tag-feature { color: var(--tone-accent); background: var(--mccal-task-soft); }
.mccal-tag.mccal-tag-bug { color: var(--tone-error); background: color-mix(in srgb, var(--tone-error) 15%, transparent); }
.mccal-rail-empty { font-size: 11px; color: var(--text-subtle); padding: 10px 12px; }

/* \u2500\u2500 Event editor (overlay) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.mccal-scrim {
  position: absolute; inset: 0; z-index: 20;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--bg-app) 55%, transparent);
}
.mccal-editor {
  width: 460px; max-width: calc(100% - 32px); max-height: calc(100% - 32px);
  overflow-y: auto;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  box-shadow: 0 12px 40px color-mix(in srgb, var(--bg-app) 70%, transparent);
  display: flex;
}
.mccal-ed-kindbar { width: 3px; flex: 0 0 auto; border-radius: 3px; margin: 14px 0 14px 14px; background: var(--mccal-note); }
.mccal-ed-main { flex: 1; padding: 14px 18px; min-width: 0; }
.mccal-ed-kicker { font-size: 10px; color: var(--text-subtle); text-transform: uppercase; letter-spacing: 0.05em; }
.mccal-ed-title-in {
  width: 100%; margin-top: 6px; font-size: 15px; font-weight: 600;
  background: transparent; border: none; outline: none; color: var(--text-strong);
  border-bottom: 1px solid var(--border-subtle); padding: 2px 0 6px;
}
.mccal-ed-title-in:focus { border-bottom-color: var(--accent-primary); }
.mccal-ed-src {
  display: inline-flex; align-items: center; gap: 5px; margin-top: 8px;
  font-size: 10.5px; color: var(--text-muted);
  background: var(--mccal-backlog-soft); border: 1px solid var(--border-subtle);
  padding: 3px 8px; border-radius: 999px;
}
.mccal-ed-src .mccal-ed-src-id { color: var(--mccal-backlog); font-weight: 700; }
.mccal-kinds { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 12px; }
.mccal-kbtn {
  appearance: none; border: 1px solid var(--border-default); background: var(--bg-surface-raised);
  border-radius: 6px; padding: 5px 4px; font-size: 10.5px; color: var(--text-muted);
  cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 3px;
}
.mccal-kbtn:hover { background: var(--bg-hover); }
.mccal-kbtn:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.mccal-kbtn[aria-pressed='true'] { border-color: var(--border-strong); background: var(--bg-selected); color: var(--text-strong); }
.mccal-kbtn .mccal-kd { width: 14px; height: 4px; border-radius: 2px; background: var(--mccal-note); }
.mccal-kbtn.mccal-k-task .mccal-kd { background: var(--mccal-task); }
.mccal-kbtn.mccal-k-automation .mccal-kd { background: var(--mccal-automation); }
.mccal-field { margin-top: 12px; }
.mccal-field label { display: block; font-size: 10.5px; color: var(--text-subtle); margin-bottom: 3px; }
.mccal-field input, .mccal-field select, .mccal-field textarea {
  width: 100%; font-size: 12px; color: var(--text-default);
  background: var(--bg-surface-raised); border: 1px solid var(--border-default);
  border-radius: 6px; padding: 5px 8px; outline: none;
}
.mccal-field input:focus-visible, .mccal-field select:focus-visible, .mccal-field textarea:focus-visible { box-shadow: var(--focus-ring); }
.mccal-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.mccal-hint { font-size: 10.5px; color: var(--tone-warn); margin-top: 6px; }
.mccal-error { font-size: 11px; color: var(--tone-error); margin-top: 8px; }
.mccal-ed-foot { display: flex; align-items: center; gap: 8px; margin-top: 16px; }
.mccal-ed-foot .mccal-spacer { flex: 1; }
.mccal-btn.mccal-danger { color: var(--tone-error); }
.mccal-btn.mccal-danger:hover { background: color-mix(in srgb, var(--tone-error) 12%, transparent); }

/* Reduced motion: this module animates nothing, but guard any future drift. */
@media (prefers-reduced-motion: reduce) {
  .mccal-root *, .mccal-root *::before, .mccal-root *::after {
    animation: none !important;
    transition: none !important;
  }
}
`
);

// src/renderer.tsx
import { jsx as jsx8 } from "react/jsx-runtime";
function createCalendarTemplate() {
  return {
    id: "calendar-week",
    name: "Calendar",
    description: "Week grid with a planning rail: drop work onto time.",
    previewSlots: [
      { x: 4, y: 4, w: 236, h: 102, type: "editor", label: "Week" },
      { x: 244, y: 4, w: 52, h: 102, type: "explorer", label: "Plan" }
    ],
    layout: {
      global: { tabSetEnableDrop: true, tabEnableClose: true },
      layout: {
        type: "row",
        children: [
          {
            type: "tabset",
            weight: 100,
            children: [{ type: "tab", name: "Calendar", component: "calendar.week" }]
          }
        ]
      }
    }
  };
}
var registerRenderer = (host) => {
  injectStylesOnce();
  host.registerPanel("calendar.week", (props) => /* @__PURE__ */ jsx8(CalendarPanel, { ...props, host, initialView: "week" }));
  host.registerPanel("calendar.day", (props) => /* @__PURE__ */ jsx8(CalendarPanel, { ...props, host, initialView: "day" }));
  host.registerPanel("calendar.month", (props) => /* @__PURE__ */ jsx8(CalendarPanel, { ...props, host, initialView: "month" }));
  host.registerWorkspaceType({
    id: "calendar",
    label: "Calendar",
    description: "A time-gridded planner: notes and tasks on your week, and Backlog items and automations scheduled to run at a time as chats.",
    icon: CalendarIcon,
    accentToken: "--tone-accent",
    searchTerms: ["calendar", "schedule", "planner", "outlook", "week", "agenda", "time block"],
    createTemplate: createCalendarTemplate,
    topBarViews: {
      label: "Calendar",
      views: [
        { component: "calendar.day", name: "Day" },
        { component: "calendar.week", name: "Week" },
        { component: "calendar.month", name: "Month" }
      ]
    },
    pickerOrder: 40
  });
  host.registerBacklogItemAction({
    id: "schedule-on-calendar",
    label: "Schedule on calendar\u2026",
    category: "execute",
    isVisible: (context) => context.item.status !== "completed" && context.item.status !== "archived",
    run: async (context) => scheduleFromBacklog(host, context)
  });
  host.registerBacklogLinkProvider({
    moduleId: "calendar",
    targetKinds: ["calendar.event"],
    resolveLinkStatus: async ({ workspaceId, link }) => {
      try {
        const response = await host.invoke(CH_EVENTS_LOAD, { workspaceId });
        const exists = response.events.some((event) => event.id === link.target.id);
        return { ...link, status: exists ? "active" : "unknown", canOpen: exists };
      } catch {
        return { ...link, status: "unknown", canOpen: false };
      }
    },
    openLink: async ({ workspaceId, link }) => requestReveal({ workspaceId, eventId: link.target.id })
  });
  host.registerCommand({
    id: "new-event",
    title: "Calendar: New Event",
    category: "Calendar",
    scopes: ["global"],
    availability: ["activeWorkspace"],
    run: () => {
      if (!requestNewEvent()) {
        console.info("[calendar] No calendar panel is open \u2014 open a Calendar workspace first.");
      }
    }
  });
  host.registerCommand({
    id: "plan-my-day",
    title: "Calendar: Plan My Day",
    category: "Calendar",
    scopes: ["global"],
    availability: ["activeWorkspace"],
    run: () => {
      if (!requestPlanDay()) {
        console.info("[calendar] No calendar panel is open \u2014 open a Calendar workspace first.");
      }
    }
  });
};
async function scheduleFromBacklog(host, context) {
  const claimed = requestScheduleOnCalendar({
    workspaceId: context.workspaceId,
    path: context.item.path,
    title: context.item.title
  });
  if (claimed) {
    await context.updateModuleMetadata("calendar", {
      scheduleRequestedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return;
  }
  const tomorrow = /* @__PURE__ */ new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const stamp = toLocalDateTime(/* @__PURE__ */ new Date());
  const event = {
    id: `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: context.item.title,
    kind: "automation",
    start: toLocalDateTime(tomorrow),
    durationMinutes: 30,
    source: { path: context.item.path, title: context.item.title },
    createdAt: stamp,
    updatedAt: stamp
  };
  const scheduled = await host.invoke(CH_SCHEDULE, {
    workspaceId: context.workspaceId,
    event
  });
  if (!scheduled.ok) throw new Error(`${scheduled.code}: ${scheduled.message}`);
  event.automationId = scheduled.automationId;
  const response = await host.invoke(CH_EVENTS_LOAD, {
    workspaceId: context.workspaceId
  });
  await host.invoke(CH_EVENTS_SAVE, {
    workspaceId: context.workspaceId,
    events: [...response.events, event]
  });
  await context.addLink({
    id: "calendar:scheduled-event",
    moduleId: "calendar",
    type: "execution",
    label: `Scheduled: ${event.start.replace("T", " ")}`,
    target: { kind: "calendar.event", id: event.id },
    status: "active",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  await context.updateModuleMetadata("calendar", {
    eventId: event.id,
    scheduledStart: event.start,
    automationId: event.automationId
  });
}
export {
  registerRenderer
};

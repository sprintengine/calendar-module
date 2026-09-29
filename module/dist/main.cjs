"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  cadenceFor: () => cadenceFor,
  registerMain: () => registerMain,
  resolveWorkspaceRoot: () => resolveWorkspaceRoot,
  runPermissionPreset: () => runPermissionPreset,
  runPrompt: () => runPrompt,
  runScheduledAction: () => runScheduledAction,
  scheduleEvent: () => scheduleEvent,
  toCalendarRuns: () => toCalendarRuns,
  writeBacklogItem: () => writeBacklogItem
});
module.exports = __toCommonJS(main_exports);
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");

// node_modules/@sprintengine/module-sdk/dist/conversation.js
var conversationModuleServiceToken = {
  key: "conversation.module-service"
};
function getConversationService(host) {
  const registry = host.requireService(conversationModuleServiceToken);
  const moduleId = host.moduleId;
  return {
    create: (input) => registry.create(moduleId, input),
    send: (ref, input) => registry.send(moduleId, ref, input),
    interrupt: (ref) => registry.interrupt(moduleId, ref),
    respondToApproval: (ref, input) => registry.respondToApproval(moduleId, ref, input),
    stop: (ref) => registry.stop(moduleId, ref),
    subscribe: (ref, cb) => registry.subscribe(moduleId, ref, cb),
    transcript: (ref) => registry.transcript(moduleId, ref),
    list: (filter) => registry.list(moduleId, filter),
    watch: (filter, cb) => registry.watch(moduleId, filter, cb)
  };
}

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
function registerAutomationAction(host, provider) {
  return host.requireService(automationsProviderRegistryToken).registerActionProvider(host.moduleId, provider);
}
var automationsModuleServiceToken = createServiceToken("automations.module-service");
function getAutomationsService(host) {
  const registry = host.requireService(automationsModuleServiceToken);
  const moduleId = host.moduleId;
  return {
    create: (input) => registry.create(moduleId, input),
    update: (input) => registry.update(moduleId, input),
    delete: (input) => registry.delete(moduleId, input),
    list: (input) => registry.list(moduleId, input),
    listRuns: (input) => registry.listRuns(moduleId, input),
    onRunEvent: (listener) => registry.onRunEvent(moduleId, listener)
  };
}
var companionAgentsModuleServiceToken = createServiceToken("companion-agents.module-service");
var moduleStorageToken = createServiceToken("core.module-storage");
function getModuleStorage(host) {
  const registry = host.requireService(moduleStorageToken);
  const moduleId = host.moduleId;
  return {
    get: (input) => registry.get(moduleId, input),
    set: (input) => registry.set(moduleId, input),
    delete: (input) => registry.delete(moduleId, input),
    list: (input) => registry.list(moduleId, input)
  };
}

// src/types.ts
var CH_EVENTS_LOAD = "calendar:events-load";
var CH_EVENTS_SAVE = "calendar:events-save";
var CH_SCHEDULE = "calendar:schedule";
var CH_UNSCHEDULE = "calendar:unschedule";
var CH_PING = "calendar:ping";
var CH_CREATE_BACKLOG_ITEM = "calendar:create-backlog-item";
var CH_RUNS = "calendar:runs";
var TOPIC_RUNS_CHANGED = "runs-changed";

// src/main.ts
function requireWorkspaceId(value, channel) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${channel} requires a workspaceId.`);
  return value;
}
async function resolveWorkspaceRoot(host, workspaceId) {
  const view = await host.requireService(WorkspaceContextToken).get(workspaceId);
  if (!view) throw new Error(`Workspace "${workspaceId}" is not resolvable yet \u2014 retry shortly.`);
  if (!view.folderPath) throw new Error(`Workspace "${workspaceId}" has no folder, so it cannot run scheduled events.`);
  return view.folderPath;
}
var EVENTS_KEY = "events";
function globalEventsKey(workspaceId) {
  const safe = workspaceId.toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/^[^a-z0-9]+/, "");
  return `events-${safe || "workspace"}`.slice(0, 64);
}
async function eventsScope(host, workspaceId) {
  const view = await host.requireService(WorkspaceContextToken).get(workspaceId);
  if (!view) throw new Error(`Workspace "${workspaceId}" is not resolvable yet \u2014 retry shortly.`);
  return view.folderPath ? { key: EVENTS_KEY, workspaceRoot: view.folderPath } : { key: globalEventsKey(workspaceId) };
}
function normalizeEvent(event) {
  return event.kind === "sprint" ? { ...event, kind: "automation" } : event;
}
async function loadEvents(host, storage, workspaceId) {
  const scope = await eventsScope(host, workspaceId);
  const record = await storage.get(scope);
  if (!record.ok || !record.found) return [];
  const parsed = record.value;
  if (parsed.version !== 1 || !Array.isArray(parsed.events)) return [];
  return parsed.events.map(normalizeEvent);
}
async function saveEvents(host, storage, workspaceId, events) {
  const file = { version: 1, events };
  const scope = await eventsScope(host, workspaceId);
  const saved = await storage.set({ ...scope, value: file });
  if (!saved.ok) throw new Error(`Saving calendar events failed (${saved.code}): ${saved.message}`);
}
function cadenceFor(event) {
  const timeLocal = event.start.slice(11, 16);
  if (event.repeat === "daily") return { type: "daily", timeLocal };
  if (event.repeat === "weekly") {
    const day = (/* @__PURE__ */ new Date(`${event.start}:00`)).getDay();
    return { type: "weekly", timeLocal, daysOfWeek: [day] };
  }
  return { type: "at", datetime: event.start };
}
function runPrompt(event) {
  const lines = ["You are running a scheduled task created from a SprintEngine Calendar event."];
  lines.push(`Event: ${event.title}`);
  if (event.description) lines.push(`Details: ${event.description}`);
  if (event.source) {
    lines.push(
      `Source backlog item: ${event.source.displayId ?? ""} ${event.source.title ?? ""}`.trim()
    );
    lines.push(`Work the item at: ${event.source.path}`);
    lines.push("Read that file first and treat it as the work brief; keep its frontmatter status current.");
  }
  return lines.join("\n");
}
function runPermissionPreset(value) {
  return value === "bypass" ? "bypass" : "none";
}
var runScheduledAction = {
  kind: "calendar.run-scheduled",
  label: "Run a calendar event",
  summary: "Starts a chat with the event as its brief.",
  configSchema: {
    type: "object",
    properties: {
      prompt: { type: "string" },
      cli: { type: "string" },
      cliModel: { type: "string" },
      permissionPreset: { type: "string", enum: ["none", "bypass"] },
      eventId: { type: "string" },
      eventTitle: { type: "string" }
    },
    required: ["prompt"]
  },
  run: async (config, ctx) => {
    const cfg = config ?? {};
    if (typeof cfg.prompt !== "string" || cfg.prompt.trim().length === 0) {
      return { status: "failed", summary: "Calendar run config had no prompt." };
    }
    ctx.reportProgress({ summary: `Calendar: launching "${cfg.eventTitle ?? "scheduled event"}".` });
    const launched = await ctx.spawnAgent({
      folderPath: ctx.workspaceRoot,
      prompt: cfg.prompt,
      permissionPreset: runPermissionPreset(cfg.permissionPreset),
      ...cfg.cli ? { cli: cfg.cli } : {},
      ...cfg.cliModel ? { model: cfg.cliModel } : {},
      name: cfg.eventTitle ? `Calendar: ${cfg.eventTitle}` : "Calendar run"
    });
    return {
      status: "running",
      summary: `Calendar event chat ${launched.agentId} started; working\u2026`,
      workspaceId: launched.workspaceId,
      agentId: launched.agentId,
      sessionId: launched.sessionId
    };
  }
};
async function scheduleEvent(host, request) {
  const { event } = request;
  const workspaceRoot = await resolveWorkspaceRoot(host, request.workspaceId);
  const automations = getAutomationsService(host);
  const created = await automations.create({
    workspaceRoot,
    draft: {
      name: `Calendar: ${event.title}`,
      status: "enabled",
      trigger: {
        kind: "schedule",
        config: {
          kind: "schedule",
          cadence: cadenceFor(event),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      },
      action: {
        kind: "calendar.run-scheduled",
        config: {
          prompt: runPrompt(event),
          eventId: event.id,
          eventTitle: event.title,
          permissionPreset: runPermissionPreset(event.permissionPreset),
          ...event.cli ? { cli: event.cli } : {},
          ...event.cliModel ? { cliModel: event.cliModel } : {}
        }
      }
    }
  });
  if (!created.ok) return { ok: false, code: created.code, message: created.message };
  return { ok: true, automationId: created.automation.id };
}
function writeBacklogItem(workspaceRoot, input, now = /* @__PURE__ */ new Date()) {
  const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "task";
  const date = now.toISOString().slice(0, 10);
  let relativePath = `backlog/${date}-${slug}.md`;
  let counter = 2;
  while ((0, import_node_fs.existsSync)((0, import_node_path.join)(workspaceRoot, relativePath))) {
    relativePath = `backlog/${date}-${slug}-${counter}.md`;
    counter += 1;
  }
  const absolute = (0, import_node_path.join)(workspaceRoot, relativePath);
  (0, import_node_fs.mkdirSync)((0, import_node_path.dirname)(absolute), { recursive: true });
  const body = [
    "---",
    "status: ready",
    "---",
    "",
    `# ${input.title}`,
    "",
    input.description?.trim() ? `${input.description.trim()}
` : "",
    "_Created from a SprintEngine Calendar task._",
    ""
  ].join("\n");
  (0, import_node_fs.writeFileSync)(absolute, body, "utf8");
  return { relativePath, path: absolute };
}
var LIVE_STATUSES = /* @__PURE__ */ new Set(["starting", "ready", "active", "awaiting_approval"]);
function toCalendarRuns(conversations) {
  return conversations.filter((conversation) => LIVE_STATUSES.has(conversation.status)).map(({ workspaceId, agentId, name, status }) => ({ workspaceId, agentId, name, status }));
}
function conversationsAvailable(host) {
  return host.supports("conversations");
}
var registerMain = (host) => {
  registerAutomationAction(host, runScheduledAction);
  const storage = getModuleStorage(host);
  host.registerIpc(CH_PING, async () => ({ ok: true, module: "calendar" }));
  host.registerIpc(CH_EVENTS_LOAD, async (_event, payload) => {
    const workspaceId = requireWorkspaceId(payload?.workspaceId, CH_EVENTS_LOAD);
    return { events: await loadEvents(host, storage, workspaceId) };
  });
  host.registerIpc(CH_EVENTS_SAVE, async (_event, payload) => {
    const { workspaceId, events } = payload ?? {};
    if (!Array.isArray(events)) throw new Error(`${CH_EVENTS_SAVE} requires an events array.`);
    await saveEvents(host, storage, requireWorkspaceId(workspaceId, CH_EVENTS_SAVE), events);
    return { saved: true };
  });
  host.registerIpc(CH_SCHEDULE, async (_event, payload) => {
    const request = payload ?? {};
    const workspaceId = requireWorkspaceId(request.workspaceId, CH_SCHEDULE);
    if (typeof request.event?.start !== "string") {
      throw new Error(`${CH_SCHEDULE} requires an event with a start time.`);
    }
    return scheduleEvent(host, { workspaceId, event: request.event });
  });
  host.registerIpc(CH_CREATE_BACKLOG_ITEM, async (_event, payload) => {
    const { workspaceId, title, description } = payload ?? {};
    const id = requireWorkspaceId(workspaceId, CH_CREATE_BACKLOG_ITEM);
    if (typeof title !== "string" || title.trim().length === 0) {
      throw new Error(`${CH_CREATE_BACKLOG_ITEM} requires a title.`);
    }
    const workspaceRoot = await resolveWorkspaceRoot(host, id);
    return writeBacklogItem(workspaceRoot, {
      title,
      ...typeof description === "string" ? { description } : {}
    });
  });
  host.registerIpc(CH_UNSCHEDULE, async (_event, payload) => {
    const { workspaceId, automationId } = payload ?? {};
    const id = requireWorkspaceId(workspaceId, CH_UNSCHEDULE);
    if (typeof automationId !== "string") throw new Error(`${CH_UNSCHEDULE} requires an automationId.`);
    const workspaceRoot = await resolveWorkspaceRoot(host, id);
    const result = await getAutomationsService(host).delete({ workspaceRoot, automationId });
    return result.ok ? { ok: true } : { ok: false, message: `${result.code}: ${result.message}` };
  });
  let stopWatching;
  const ensureWatching = () => {
    if (stopWatching || !conversationsAvailable(host)) return;
    stopWatching = getConversationService(host).watch(void 0, () => host.emit(TOPIC_RUNS_CHANGED));
  };
  host.onStartup(ensureWatching);
  host.onShutdown(() => {
    stopWatching?.();
    stopWatching = void 0;
  });
  host.registerIpc(CH_RUNS, async () => {
    if (!conversationsAvailable(host)) return { available: false, runs: [] };
    ensureWatching();
    return { available: true, runs: toCalendarRuns(getConversationService(host).list()) };
  });
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  cadenceFor,
  registerMain,
  resolveWorkspaceRoot,
  runPermissionPreset,
  runPrompt,
  runScheduledAction,
  scheduleEvent,
  toCalendarRuns,
  writeBacklogItem
});

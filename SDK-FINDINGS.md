# SDK Findings — Calendar Workspace Benchmark (v0.4.0)

Per §7 of the benchmark brief. One entry per friction point, in the mandated shape.
Expected v0.4 gaps are only written up here once **verified live** during this build.

Severity: `blocker` | `workaround` | `polish`

---

### Workspace type's createTemplate() was ignored by the creation hub — FIXED in app
- Feature it blocked: the entire workspace — a created `calendar` workspace got the
  standard IDE layout (Files/Editor/Agent) instead of the calendar panel. `createTemplate`
  was decorative: nothing in the creation flow consulted it for module types.
- What the SDK offered: `WorkspaceTypeDefinition.createTemplate()` documented as the
  workspace's layout; `creationStepsId` typed as `string` but validated against a closed
  shell-owned enum ('standard' | 'switchboard' | …) — a module can never mint a valid one.
- What was missing: unknown modes fell through to the standard controller
  (IDE layout picker + `LAYOUT_TEMPLATES`), overriding the module template.
- Severity: **blocker** (verified live: workspace created with Solo-Dev IDE layout).
- Fix applied in the Multicode repo (left uncommitted for review):
  `creationStepFlows.stepsForMode` now resolves a registered type without a known
  `creationStepsId` to the zero-config `['workspace']` flow, and `NewWorkspacePanel` gained
  a module-type branch backed by a new `buildModuleTypeCreation` controller that uses the
  registered `createTemplate()`. Tests extended (`creationStepFlows.test.ts`,
  `controllers.test.ts`); both green, web typecheck clean.
- Proposed SDK follow-up: document that module types get the zero-config flow, and widen
  `creationStepsId` docs to say shell flow ids are not module-assignable.

### No workspaceId → workspace root resolution
- Feature it blocked: creating automations (the scoped service requires `workspaceRoot`) and
  any per-workspace-folder persistence, from a panel that only receives `workspaceId`.
- What the SDK offered: `WorkspacePanelProps = { workspaceId }`; `ModuleAutomationsService`
  keyed by `workspaceRoot`; nothing maps one to the other in either process.
- What was missing / had to be escaped to: no escape used — the module *derives* the root
  opportunistically: from `BacklogItemView.path` minus `relativePath` (needs ≥1 backlog item),
  or from a drop payload's `rootPath`. A calendar in a workspace with no backlog items and no
  drops cannot schedule runs at all (the editor surfaces this state).
- Severity: **workaround** (borderline blocker — the fallback chain covers the benchmark
  workspace but is not a real contract).
- Proposed SDK change: `RendererHost.getWorkspace(workspaceId): Promise<{ id, name,
  folderPath }>` (read-only, `ipc:workspace-read` disclosure), or pass `workspaceRoot` in
  `WorkspacePanelProps`.
- **RESOLVED — SDK Unreleased post-0.4.0 (2026-07-10, MC-1539)**: exactly the proposed
  shape — renderer `RendererHost.getWorkspace(workspaceId)` and main-side
  `WorkspaceContextToken` both resolve `ModuleWorkspaceView { id, name, folderPath, mode }`
  (null for unknown ids, never a throw; `ipc:workspace-read` disclosure). This module now
  resolves its root through `getWorkspace`; `deriveWorkspaceRoot` and the drop-payload
  fallback are deleted.

### No module CSS channel
- Feature it blocked: styling the entire workspace UI.
- What the SDK offered: `entry.renderer` is one ESM JS bundle; nothing for stylesheets.
- What was missing / had to be escaped to: injected a `<style>` element from JS at
  registration. Works, but unmanaged (no ordering/scoping story vs app styles).
- Severity: workaround
- Proposed SDK change: `entry.rendererCss` manifest field (or a documented blessing of the
  inject-a-style-tag pattern, including unload semantics).

### BacklogItemView has no numeric/display id
- Feature it blocked: showing `MC-###` chips on rail cards, event blocks, and the editor's
  source chip (the brief's §3.4 read-model sketch even lists `numericId`/`displayId`).
- What the SDK offered: `id` (opaque hash), `title`, `path`, `metadata` (module-scoped),
  `sourceContent`.
- What was missing / had to be escaped to: re-parsed `id:` out of `sourceContent` frontmatter
  and hard-assumed the `MC` key prefix — the workspace's real key lives in
  `.multi-code/backlog/config.json`, which the SDK does not expose (readable only via own
  `entry.main` fs + the workspace root, itself a finding above).
- Severity: workaround
- Proposed SDK change: add `numericId?: number` and `displayId?: string` to `BacklogItemView`
  — the app already computes both for its own panel.

### Published tone set is flat — no soft/hover variants
- Feature it blocked: the brief's own mockup styles event blocks with `--tone-*-soft`
  backgrounds and the now-line clock with `--accent-primary-hover`; neither is in
  `THEME_TOKENS`.
- What the SDK offered: 23 tokens; tones are single values.
- What was missing / had to be escaped to: derived soft fills as
  `color-mix(in srgb, var(--tone-*) 15%, transparent)` — stays hex-free and theme-driven, but
  modules re-derive what every app surface already has tuned per theme.
- Severity: polish
- Proposed SDK change: either publish the `-soft` variants (the app themes already define
  them) or document color-mix derivation as the sanctioned pattern.

### No module storage API (known v0.4 deferral — confirmed live)
- Feature it blocked: persisting calendar events per workspace.
- What the SDK offered: `registerIpc` + `entry.main` Node access (the deliberate v0.4 answer).
- What was missing / had to be escaped to: hand-rolled JSON files in
  `~/.multicode/calendar-data/<workspaceId>.json` — in the user's home, not the workspace,
  because of the workspaceRoot gap above.
- Severity: workaround
- Proposed SDK change: as the epic deferred it — module KV keyed (moduleId, workspaceId),
  informed by exactly this pattern.
- **RESOLVED — SDK Unreleased post-0.4.0 (2026-07-10, MC-1536)**:
  `getModuleStorage(host)` → scoped `get`/`set`/`delete`/`list`, host-placed
  (workspace `.multi-code/modules/calendar/`, or the per-user global store),
  `storage` disclosure permission. This module now persists events through it,
  composed with `WorkspaceContextToken` for workspaceId → root; the hand-rolled
  `~/.multicode/calendar-data` files (undisclosed home-dir writes) are gone.

# Sprint Engine Calendar — an extension for SprintEngine Studio

An Outlook-style calendar **workspace type** for SprintEngine Studio, built entirely outside
the Studio repo against `@sprintengine/module-sdk` **1.0.0-beta.0** (host API 1). It started
as the SDK-ergonomics benchmark — `SDK-FINDINGS.md` (gap report) and `BUILD-LOG.md` (step
log) are kept as that history.

## What it does

- **Week / Day / Month views**: time gutter, day columns, all-day row, today highlight,
  now-line, overlap lanes; drag-create, drag-move, resize-to-reschedule (15-min snap);
  daily/weekly repeats render an occurrence on every matching day.
- **Three event kinds**: Note, Task (optionally creating a real `backlog/` item) and
  **Automation**, which creates a *real enabled Automation* at the event's time (one-shot,
  daily or weekly). When it fires, the module's action provider starts the run as a
  **chat** (`ctx.spawnAgent`) with the event — and its Backlog item, if any — as the brief.
  The editor picks the agent, model and **permission preset**: `Agent's own settings`
  (`none`, the default — the CLI's own configuration decides) or `Skip every permission
  prompt` (`bypass`). The preset is always passed explicitly, never inherited.
- **Run readout**: the toolbar shows how many of the calendar's run chats are working
  (the module's own conversations, `conversation:read`); click it to open the first.
- **Backlog integration**: planning rail fed live by `watchBacklogItems`; drag a rail card
  (or a Backlog-panel row — published file-drop contract) onto the grid to get a pre-filled
  editor; a "Schedule on calendar…" Backlog item action; `calendar.event` link provider.
- **⌘K command bar** (create / navigate / switch views / schedule items), two palette
  commands, **"Plan my day"** first-fit auto-scheduling into free slots, and **"Run day
  plan in a chat"**, which opens a chat (`host.openChat`) that works today's events.
- **Theming**: styled exclusively with published `THEME_TOKENS` CSS variables.

The renderer only ever names a workspace by id. `entry.main` resolves the folder it
schedules into or writes a Backlog item under through the host's workspace context, so no
path in an IPC payload can aim the module's writes elsewhere.

## Layout

- `plugin.json` — the signed bundle manifest a GitHub or marketplace install reads.
- `module/` — the installable module: `manifest.json` (signed, with its `files` digests)
  and the built `dist/main.cjs` + `dist/renderer.mjs`. `module/dist` is committed so the
  repository installs as-is.
- `src/main.ts` — `entry.main`: event persistence (module storage), `calendar:schedule` →
  scoped Automations service, the `calendar.run-scheduled` action provider, Backlog item
  writer, and the run readout (conversation service).
- `src/renderer.tsx` + `src/ui/*` — `entry.renderer` (single-file ESM, React external).
- `scripts/` — the SDK template's `validate.mjs` and `dev-install.mjs`.

## Install

In SprintEngine Studio, install from the repository URL
(`https://github.com/sprintengine/calendar-module`) and trust the module when asked.

## Develop

```sh
npm install         # deps incl. the vendored SDK tarball (1.0.0-beta.0 is not on npm yet)
npm run check       # typecheck + tests + build to module/dist + validate
npm run sign        # sign module/manifest.json (writes its files map) and plugin.json
npm run validate    # the app's own checks: manifest, host API, digests, signatures
npm run dev:install # build, sign and side-load into ~/.sprintengine/modules/calendar
```

Rebuilding changes `module/dist`, so run `npm run sign` again before committing a build.

### Signing key

The ed25519 signing key lives **outside the repository** at
`~/.sprintengine/keys/calendar-signing.key` (mode 600). `npm run sign` and
`npm run dev:install` use it by default; set `SPRINTENGINE_SIGNING_KEY` to use another.
Never copy it into the project — `npm run validate` fails on any `*.key`/`*.pem` here.

## Known limitations

- Display ids assume the `MC` backlog key (the SDK's Backlog view exposes no display id).
- A scheduled run's chat starts in the folder's Automations workspace, not the calendar
  workspace; the run readout and its click-through follow it there.

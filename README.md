# Multicode Calendar — third-party capability module (SDK benchmark artifact)

An Outlook-style calendar **workspace type** for Multicode, built entirely outside the
Multicode repo against the packed `@multicode/module-sdk` **0.4.0** tarball, per
`benchmarks/2026-07-05-sdk-calendar-workspace.md`. It is both a real scheduling surface and
the benchmark's SDK-ergonomics probe — see `SDK-FINDINGS.md` (gap report) and
`BUILD-LOG.md` (step log + honest mistake ledger).

## What it does

- **Week / Day / Month views**: time gutter, day columns, all-day row, today highlight,
  now-line, overlap lanes; drag-create, drag-move, resize-to-reschedule (15-min snap).
- **Four event kinds**: Note, Task (optionally creating a real `backlog/` item),
  **Automation** and **Sprint** — the latter two create a *real enabled Automation* with the
  one-shot `at` cadence at the cell's time; when it fires, the module's action provider
  spawns an agent through the shared session runtime (`ctx.spawnAgent`), never a bespoke PTY.
- **Backlog integration**: planning rail fed live by `watchBacklogItems`; drag a rail card
  (or a Backlog-panel row — published file-drop contract) onto the grid to get a pre-filled
  editor; a "Schedule on calendar…" Backlog item action; `calendar.event` link provider.
- **⌘K command bar** (create / navigate / switch views / schedule items) plus two palette
  commands, and **"Plan my day"** first-fit auto-scheduling into free slots.
- **Theming**: styled exclusively with published `THEME_TOKENS` CSS variables (soft fills
  derived via `color-mix`); re-skins with every app theme, no JS theme reads, no hex.

## Layout

- `manifest.json` — signed third-party manifest (`dependsOn: ['automations']`).
- `src/main.ts` — `entry.main` (CJS): event persistence, `calendar:schedule` →
  scoped Automations service, `calendar.run-scheduled` action provider, backlog item writer.
- `src/renderer.tsx` + `src/ui/*` — `entry.renderer` (single-file ESM, React external).
- `evidence/` — screenshots from driving the real app (trust grant, picker, grid, editor,
  drop, fire, themes, persistence).

## Build & install

```sh
npm install                 # deps incl. the local SDK tarball (SDK is not on npm)
npm run check               # typecheck + bundle to dist/
npx multicode-module sign . --key <your-key.pem>
npx multicode-module verify .
npx multicode-module pack . --out ~/.multicode/modules/calendar
```

Then trust the module in **Settings → Modules** and relaunch the app.

## Known limitations (deliberate, documented)

- Scheduling needs the workspace root, which the SDK cannot provide from a panel — the
  module derives it from backlog item paths or drop payloads (see SDK-FINDINGS).
- Display ids assume the `MC` backlog key (SDK view exposes no display id).
- No connector selector yet (connector launch is not on the SDK surface — expected gap).
- Recurring events map to daily/weekly cadences for scheduled runs; the grid renders the
  base occurrence only.
- Sprint-kind events run through `spawnAgent` with the item as brief (no SDK sprint-start).

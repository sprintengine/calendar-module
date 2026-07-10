// The SDK has no way for a module to ship a stylesheet (SDK-FINDINGS: modules
// bundle a single JS file; there is no CSS asset channel), so styles are
// injected as one <style> element. Every color comes from published
// THEME_TOKENS variables — soft fills are color-mix() over published tones
// (the mockup's --tone-*-soft variables are not in the published set), so the
// UI re-skins with the active theme with no JS theme observation and no
// literal colors.

const STYLE_ELEMENT_ID = 'multicode-calendar-module-styles'

export function injectStylesOnce(): void {
  if (document.getElementById(STYLE_ELEMENT_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ELEMENT_ID
  style.textContent = STYLES
  document.head.appendChild(style)
}

const STYLES = /* css */ `
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
  --mccal-sprint: var(--accent-primary);
  --mccal-backlog: var(--tone-merged);
  --mccal-note-soft: color-mix(in srgb, var(--tone-neutral) 16%, transparent);
  --mccal-task-soft: color-mix(in srgb, var(--tone-accent) 15%, transparent);
  --mccal-automation-soft: color-mix(in srgb, var(--tone-warn) 15%, transparent);
  --mccal-sprint-soft: color-mix(in srgb, var(--accent-primary) 14%, transparent);
  --mccal-backlog-soft: color-mix(in srgb, var(--tone-merged) 15%, transparent);
}

/* ── Toolbar ─────────────────────────────────────────────────────────────── */
.mccal-live {
  font-size: 11px;
  line-height: 16px;
  padding: 2px 8px;
  border-radius: 999px;
  color: var(--tone-ok, var(--text-muted));
  border: 1px solid var(--border-subtle);
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

/* ── Body: grid + rail ───────────────────────────────────────────────────── */
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
.mccal-ev.mccal-sprint { border-left-color: var(--mccal-sprint); background: var(--mccal-sprint-soft); }
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

/* ── Month view ──────────────────────────────────────────────────────────── */
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
.mccal-mchip.mccal-sprint { border-left-color: var(--mccal-sprint); background: var(--mccal-sprint-soft); }
.mccal-mmore { font-size: 9.5px; color: var(--text-subtle); }

/* ── Planning rail ───────────────────────────────────────────────────────── */
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

/* ── Event editor (overlay) ──────────────────────────────────────────────── */
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
.mccal-kbtn.mccal-k-sprint .mccal-kd { background: var(--mccal-sprint); }
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

// In-panel ⌘K command bar: create, navigate, switch views, schedule rail
// items. Scoped to the calendar panel (not the app palette — module commands
// are also registered there via registerCommand).

import { useEffect, useMemo, useRef, useState } from 'react'

export type CommandBarAction = {
  id: string
  label: string
  hint?: string
  run(): void
}

type CommandBarProps = {
  actions: CommandBarAction[]
  onClose(): void
}

export function CommandBar({ actions, onClose }: CommandBarProps) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => inputRef.current?.focus(), [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return actions
    return actions.filter((action) => action.label.toLowerCase().includes(q))
  }, [actions, query])

  useEffect(() => setIndex(0), [query])

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIndex((current) => Math.min(filtered.length - 1, current + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIndex((current) => Math.max(0, current - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const action = filtered[index]
      if (action) {
        onClose()
        action.run()
      }
    }
  }

  return (
    <div className="mccal-scrim" style={{ alignItems: 'flex-start', paddingTop: 80 }} onClick={onClose}>
      <div
        className="mccal-editor"
        style={{ width: 420, flexDirection: 'column', padding: 8 }}
        role="dialog"
        aria-modal="true"
        aria-label="Calendar commands"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="mccal-ed-title-in"
          style={{ marginTop: 0, fontSize: 13 }}
          placeholder="Type a command… (new event, today, week, plan my day, schedule …)"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded="true"
          aria-controls="mccal-cmdk-list"
        />
        <div id="mccal-cmdk-list" role="listbox" style={{ marginTop: 6, maxHeight: 260, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div className="mccal-rail-empty">No matching command.</div>
          ) : (
            filtered.map((action, i) => (
              <div
                key={action.id}
                role="option"
                aria-selected={i === index}
                className="mccal-card"
                style={i === index ? { background: 'var(--bg-selected)', borderColor: 'var(--border-strong)' } : undefined}
                onMouseEnter={() => setIndex(i)}
                onClick={() => {
                  onClose()
                  action.run()
                }}
              >
                <span className="mccal-card-title">{action.label}</span>
                {action.hint ? <span className="mccal-card-meta">{action.hint}</span> : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

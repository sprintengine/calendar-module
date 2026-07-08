// Date helpers — local wall-clock throughout, matching the `at` cadence and
// the event model's `YYYY-MM-DDTHH:mm` shape. No date library: the module
// ships as one bundle and the needs are small.

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function toLocalDateTime(d: Date): string {
  return `${toDateKey(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function parseLocalDateTime(value: string): Date {
  // `YYYY-MM-DDTHH:mm` parsed as local time (Date's own parser would treat
  // some forms as UTC; construct explicitly).
  const [datePart, timePart = '00:00'] = value.split('T')
  const [y, m, day] = datePart.split('-').map(Number)
  const [h, min] = timePart.split(':').map(Number)
  return new Date(y, (m ?? 1) - 1, day ?? 1, h ?? 0, min ?? 0, 0, 0)
}

export function startOfWeek(d: Date): Date {
  // Monday-start weeks (Outlook default in EU locales).
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = out.getDay() // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day
  out.setDate(out.getDate() + diff)
  return out
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}

export function addMinutes(value: string, minutes: number): string {
  const d = parseLocalDateTime(value)
  d.setMinutes(d.getMinutes() + minutes)
  return toLocalDateTime(d)
}

export function minutesOfDay(value: string): number {
  const d = parseLocalDateTime(value)
  return d.getHours() * 60 + d.getMinutes()
}

export function sameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b)
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function monthTitle(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function weekTitle(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  const sameMonth = weekStart.getMonth() === end.getMonth()
  const startLabel = weekStart.toLocaleDateString(
    undefined,
    sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' }
  )
  const endLabel = end.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

export function dayTitle(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

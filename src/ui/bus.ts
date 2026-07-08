// Module-internal renderer bus: lets the Backlog item action, module
// commands, and the link provider talk to whichever calendar panel is
// mounted. All parties live in the module's own bundle — this is not an app
// contract. A dispatch is "claimed" when a mounted panel handled it, so
// callers can fall back to headless behavior when no calendar is open.

export const SCHEDULE_REQUEST_EVENT = 'multicode-calendar:schedule-request'
export const REVEAL_EVENT = 'multicode-calendar:reveal-event'
export const NEW_EVENT_REQUEST = 'multicode-calendar:new-event'
export const PLAN_DAY_REQUEST = 'multicode-calendar:plan-day'

export type ScheduleRequestDetail = {
  workspaceId: string
  workspaceRoot: string
  path: string
  title: string
  displayId?: string
}

export type RevealDetail = {
  workspaceId: string
  eventId: string
}

type Claimable<T> = T & { claim(): void }

function dispatchClaimable<T extends object>(name: string, detail: T): boolean {
  let claimed = false
  const payload: Claimable<T> = { ...detail, claim: () => (claimed = true) }
  window.dispatchEvent(new CustomEvent(name, { detail: payload }))
  return claimed
}

export function requestScheduleOnCalendar(detail: ScheduleRequestDetail): boolean {
  return dispatchClaimable(SCHEDULE_REQUEST_EVENT, detail)
}

export function requestReveal(detail: RevealDetail): boolean {
  return dispatchClaimable(REVEAL_EVENT, detail)
}

export function requestNewEvent(): boolean {
  return dispatchClaimable(NEW_EVENT_REQUEST, {})
}

export function requestPlanDay(): boolean {
  return dispatchClaimable(PLAN_DAY_REQUEST, {})
}

export function onBusEvent<T>(name: string, handler: (detail: Claimable<T>) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<Claimable<T>>).detail)
  window.addEventListener(name, listener)
  return () => window.removeEventListener(name, listener)
}

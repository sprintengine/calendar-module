// Overlap layout: assign concurrent events to side-by-side lanes inside a day
// column (the classic calendar interval-partitioning pass).

import type { CalendarEvent } from '../types'
import { minutesOfDay } from './dates'

export type PositionedEvent = {
  event: CalendarEvent
  /** Minutes from midnight. */
  startMin: number
  endMin: number
  lane: number
  laneCount: number
}

export function layoutDayEvents(events: CalendarEvent[]): PositionedEvent[] {
  const sorted = [...events].sort(
    (a, b) => minutesOfDay(a.start) - minutesOfDay(b.start) || a.id.localeCompare(b.id)
  )
  const positioned: PositionedEvent[] = []
  // A cluster is a maximal run of transitively-overlapping events; lanes are
  // assigned within a cluster and every member shares the cluster's lane count.
  let cluster: PositionedEvent[] = []
  let laneEnds: number[] = []
  let clusterEnd = -1

  const flush = () => {
    const laneCount = laneEnds.length
    for (const p of cluster) p.laneCount = laneCount
    cluster = []
    laneEnds = []
    clusterEnd = -1
  }

  for (const event of sorted) {
    const startMin = minutesOfDay(event.start)
    const endMin = startMin + Math.max(15, event.durationMinutes)
    if (cluster.length > 0 && startMin >= clusterEnd) flush()
    let lane = laneEnds.findIndex((end) => end <= startMin)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(endMin)
    } else {
      laneEnds[lane] = endMin
    }
    const p: PositionedEvent = { event, startMin, endMin, lane, laneCount: 1 }
    cluster.push(p)
    positioned.push(p)
    clusterEnd = Math.max(clusterEnd, endMin)
  }
  flush()
  return positioned
}

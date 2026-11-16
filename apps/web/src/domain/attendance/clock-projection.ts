import type { ClockEvent, WorkLocation } from './types'

/**
 * Folds a day's clock events into worked and break time.
 *
 * This state machine existed twice — once for the timesheet screen and once for the payroll
 * report — with identical logic and two separate millisecond conversions. One of them divided
 * by a hundredth of an hour, so the same day showed correct hours on screen and a hundred
 * times too many in the payroll export. The arithmetic lives here once; callers keep their
 * own presentation.
 */

export const MS_PER_HOUR = 3_600_000

/** Milliseconds to hours, rounded to two decimals. */
export function msToHours(ms: number) {
  return Math.round((ms / MS_PER_HOUR) * 100) / 100
}

export type ClockTransition = {
  type: ClockEvent['type']
  occurredAt: string
  /** Location in force at this point, carried forward from the last event that set one. */
  location: WorkLocation
  /** Whether this event closed an open work interval. */
  closedWork: boolean
  /** Whether this event closed an open break interval. */
  closedBreak: boolean
}

export type ClockProjection = {
  workedMs: number
  breakMs: number
  /** First clock-in of the day, for measuring the rest period against the day before. */
  firstInAt?: string
  /** Last clock-out of the day. */
  lastOutAt?: string
  /** A shift was still open when the events ran out. */
  hasOpenShift: boolean
  /** Every event in time order, annotated with what it closed. */
  transitions: ClockTransition[]
}

export function foldClockEvents(
  events: readonly ClockEvent[]
): ClockProjection {
  const sorted = [...events].sort(
    (a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  )

  let activeStart: ClockEvent | null = null
  let breakStart: ClockEvent | null = null
  let location: WorkLocation = 'office'
  let workedMs = 0
  let breakMs = 0
  const transitions: ClockTransition[] = []

  const elapsedSince = (from: ClockEvent, to: ClockEvent) =>
    new Date(to.occurredAt).getTime() - new Date(from.occurredAt).getTime()

  sorted.forEach((event) => {
    let closedWork = false
    let closedBreak = false

    if (event.type === 'clock-in') {
      activeStart = event
      location = event.location ?? location
    }

    if (event.type === 'resume-work') {
      if (breakStart) {
        breakMs += elapsedSince(breakStart, event)
        closedBreak = true
      }
      activeStart = event
      location = event.location ?? location
      breakStart = null
    }

    if (event.type === 'start-break') {
      if (activeStart) {
        workedMs += elapsedSince(activeStart, event)
        closedWork = true
      }
      activeStart = null
      breakStart = event
    }

    if (event.type === 'clock-out') {
      if (activeStart) {
        workedMs += elapsedSince(activeStart, event)
        closedWork = true
      }
      if (breakStart) {
        breakMs += elapsedSince(breakStart, event)
        closedBreak = true
      }
      activeStart = null
      breakStart = null
    }

    transitions.push({
      type: event.type,
      occurredAt: event.occurredAt,
      location,
      closedWork,
      closedBreak,
    })
  })

  const clockOuts = sorted.filter((event) => event.type === 'clock-out')

  return {
    workedMs,
    breakMs,
    firstInAt: sorted.find((event) => event.type === 'clock-in')?.occurredAt,
    lastOutAt: clockOuts[clockOuts.length - 1]?.occurredAt,
    hasOpenShift: activeStart !== null,
    transitions,
  }
}

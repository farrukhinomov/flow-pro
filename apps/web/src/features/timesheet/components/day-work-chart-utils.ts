import { timeToMinutes } from '../timesheet-formatting'
import { getTimelineSegments } from '../timesheet-timeline'
import type { DayRow, TimelineSegment } from '../types'

export type TimelineWindow = {
  endMinutes: number
  startMinutes: number
}

export const MIN_WINDOW_MINUTES = 8 * 60
export const DEFAULT_TIMELINE_WINDOW: TimelineWindow = {
  endMinutes: 18 * 60,
  startMinutes: 8 * 60,
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function getSegmentEndMinutes(segment: TimelineSegment) {
  const startMinutes =
    timeToMinutes(segment.start) ?? DEFAULT_TIMELINE_WINDOW.startMinutes
  const endMinutes = timeToMinutes(segment.end)

  if (endMinutes !== undefined) return endMinutes

  return startMinutes + 15
}

export function buildTimelineWindow(rows: DayRow[]): TimelineWindow {
  const segments = rows.flatMap((row) => getTimelineSegments(row))
  const minuteValues = segments.flatMap((segment) => {
    const startMinutes = timeToMinutes(segment.start)
    const endMinutes = getSegmentEndMinutes(segment)

    return [startMinutes, endMinutes].filter(
      (value): value is number => value !== undefined
    )
  })

  if (minuteValues.length === 0) return DEFAULT_TIMELINE_WINDOW

  const earliest = Math.min(...minuteValues)
  const latest = Math.max(...minuteValues)
  const startMinutes = clamp(Math.floor((earliest - 60) / 60) * 60, 0, 20 * 60)
  let endMinutes = clamp(Math.ceil((latest + 60) / 60) * 60, 4 * 60, 24 * 60)

  if (endMinutes - startMinutes < MIN_WINDOW_MINUTES) {
    endMinutes = clamp(startMinutes + MIN_WINDOW_MINUTES, 4 * 60, 24 * 60)
  }

  return { endMinutes, startMinutes }
}

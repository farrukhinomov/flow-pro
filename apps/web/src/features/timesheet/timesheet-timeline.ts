import { tStatic } from '@/i18n/static'
import {
  BREAK_MARKER,
  HOME_OFFICE_MARKER,
  OPEN_CLOCK_OUT,
} from './timesheet-constants'
import { cleanTime, timeToMinutes } from './timesheet-formatting'
import type { DayRow, TimelineSegment } from './types'

/**
 * Builds the positioned segments the day chart draws.
 *
 * Split out of `timesheet-view-model.ts`: this is geometry over a single day
 * (percent offsets across a 1440-minute axis, and the overtime split at the end
 * of the day), independent of how rows are assembled or totalled.
 */

function buildTimelineSegment({
  date,
  end,
  id,
  marker,
  start,
  tone,
}: {
  date: string
  end: string
  id: string
  marker?: string
  start: string
  tone: TimelineSegment['tone']
}): TimelineSegment {
  const startMinutes = timeToMinutes(start)
  const endMinutes = timeToMinutes(end)
  const left = startMinutes === undefined ? 0 : (startMinutes / 1440) * 100
  const duration =
    startMinutes !== undefined && endMinutes !== undefined
      ? Math.max(endMinutes - startMinutes, 8)
      : 8
  const width = Math.max((duration / 1440) * 100, 1.4)

  return {
    id: `${date}-${id}`,
    start,
    end,
    marker,
    left,
    width,
    tone,
  }
}

function splitOvertimeSegments(
  segments: TimelineSegment[],
  overtimeMinutes: number
) {
  if (overtimeMinutes <= 0) return segments

  const nextSegments = [...segments]
  let remaining = overtimeMinutes

  for (let index = nextSegments.length - 1; index >= 0; index -= 1) {
    const segment = nextSegments[index]

    if (!segment || (segment.tone !== 'work' && segment.tone !== 'remote')) {
      continue
    }

    const startMinutes = timeToMinutes(segment.start)
    const endMinutes = timeToMinutes(segment.end)

    if (startMinutes === undefined || endMinutes === undefined) continue

    const duration = endMinutes - startMinutes

    if (duration <= 0) continue

    if (remaining >= duration) {
      nextSegments[index] = { ...segment, tone: 'overtime' }
      remaining -= duration
      continue
    }

    const overtimeStartMinutes = endMinutes - remaining
    const overtimeStart = `${String(Math.floor(overtimeStartMinutes / 60)).padStart(2, '0')}:${String(overtimeStartMinutes % 60).padStart(2, '0')}`

    nextSegments.splice(
      index,
      1,
      buildTimelineSegment({
        date: segment.id,
        end: overtimeStart,
        id: 'regular',
        marker: segment.marker,
        start: segment.start,
        tone: segment.tone,
      }),
      buildTimelineSegment({
        date: segment.id,
        end: segment.end,
        id: 'overtime',
        marker: tStatic('timesheetUi.overtimeShort'),
        start: overtimeStart,
        tone: 'overtime',
      })
    )
    break
  }

  return nextSegments
}

export function getTimelineSegments(row: DayRow): TimelineSegment[] {
  const segments: TimelineSegment[] = []
  const hasPositiveDuration = (start: string, end: string) => {
    const startMinutes = timeToMinutes(start)
    const endMinutes = timeToMinutes(end)

    return (
      startMinutes !== undefined &&
      endMinutes !== undefined &&
      endMinutes > startMinutes
    )
  }

  row.clockIns.forEach((start, index) => {
    const rawEnd = row.clockOuts[index]
    const end = cleanTime(rawEnd)
    const marker = rawEnd?.replace(cleanTime(rawEnd), '').trim()

    if (start && end && hasPositiveDuration(cleanTime(start), end)) {
      segments.push(
        buildTimelineSegment({
          date: row.date,
          end,
          id: `work-${index}`,
          marker: marker === BREAK_MARKER ? undefined : marker,
          start: cleanTime(start),
          tone: marker === HOME_OFFICE_MARKER ? 'remote' : 'work',
        })
      )
    }

    if (marker === BREAK_MARKER) {
      const breakEnd = cleanTime(
        row.clockIns[index + 1] ?? row.clockOuts[index + 1]
      )

      if (
        end &&
        breakEnd &&
        breakEnd !== OPEN_CLOCK_OUT &&
        hasPositiveDuration(end, breakEnd)
      ) {
        segments.push(
          buildTimelineSegment({
            date: row.date,
            end: breakEnd,
            id: `break-${index}`,
            marker,
            start: end,
            tone: 'break',
          })
        )
      }
    }
  })

  return splitOvertimeSegments(
    segments,
    Math.max(0, Math.round((row.flex ?? 0) * 60))
  )
}

import { format } from 'date-fns'
import {
  DEFAULT_EMPLOYEE_ID,
  type AttendanceCommandResult,
  type AttendancePolicyConfig,
  type AttendanceStatusType,
  type ClockEvent,
  type ClockEventDevice,
  type ClockEventGeo,
  type ClockEventSource,
  type ClockEventType,
  type OutboxOperation,
  type TodayProjection,
  type AttendanceCommandErrorCode,
  type WorkLocation,
  type WorkState,
} from './types'

const TARGET_WORK_MS = 8 * 60 * 60 * 1000
const SIX_HOURS_MS = 6 * 60 * 60 * 1000
const NINE_HOURS_MS = 9 * 60 * 60 * 1000
const TEN_HOURS_MS = 10 * 60 * 60 * 1000
const THIRTY_MINUTES_MS = 30 * 60 * 1000
const FORTY_FIVE_MINUTES_MS = 45 * 60 * 1000

function createId(prefix: string) {
  const random =
    typeof globalThis.crypto !== 'undefined' &&
    'randomUUID' in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2)

  return `${prefix}-${random}`
}

function toTimeLabel(iso: string) {
  return format(new Date(iso), 'HH:mm')
}

export class AttendanceCommandError extends Error {
  code: AttendanceCommandErrorCode

  constructor(code: AttendanceCommandErrorCode) {
    super(code)
    this.name = 'AttendanceCommandError'
    this.code = code
  }
}

export function isAttendanceCommandError(
  error: unknown
): error is AttendanceCommandError {
  return error instanceof AttendanceCommandError
}

function eventTimelineToken(event: ClockEvent) {
  if (event.type === 'clock-in') {
    return event.location === 'home-office'
      ? 'timeline.clock-in.home-office'
      : 'timeline.clock-in.office'
  }

  if (event.type === 'start-break') return 'timeline.start-break'
  if (event.type === 'resume-work') return 'timeline.resume-work'

  return 'timeline.clock-out'
}

function getLastLocation(events: ClockEvent[]): WorkLocation {
  const clockIn = [...events]
    .reverse()
    .find((event) => event.type === 'clock-in' && event.location)

  return clockIn?.location ?? 'office'
}

function getLastState(events: ClockEvent[]): WorkState {
  const last = events[events.length - 1]

  if (!last) return 'not-working'
  if (last.type === 'clock-out') return 'finished'
  if (last.type === 'start-break') return 'break'

  return 'working'
}

function getDurations(events: ClockEvent[], now: Date) {
  let activeStart: Date | null = null
  let breakStart: Date | null = null
  let workedMs = 0
  let breakMs = 0

  for (const event of events) {
    const occurredAt = new Date(event.occurredAt)

    if (event.type === 'clock-in') {
      activeStart = occurredAt
    }

    if (event.type === 'resume-work') {
      if (breakStart) breakMs += occurredAt.getTime() - breakStart.getTime()
      activeStart = occurredAt
      breakStart = null
    }

    if (event.type === 'start-break') {
      if (activeStart) workedMs += occurredAt.getTime() - activeStart.getTime()
      activeStart = null
      breakStart = occurredAt
    }

    if (event.type === 'clock-out') {
      if (activeStart) workedMs += occurredAt.getTime() - activeStart.getTime()
      if (breakStart) breakMs += occurredAt.getTime() - breakStart.getTime()
      activeStart = null
      breakStart = null
    }
  }

  const nowMs = now.getTime()

  if (activeStart) workedMs += nowMs - activeStart.getTime()
  if (breakStart) breakMs += nowMs - breakStart.getTime()

  return { workedMs: Math.max(0, workedMs), breakMs: Math.max(0, breakMs) }
}

export function createClockCommand({
  currentEvents,
  type,
  device,
  geo,
  location,
  now = new Date(),
  employeeId = DEFAULT_EMPLOYEE_ID,
  source = 'user',
}: {
  currentEvents: ClockEvent[]
  type: ClockEventType
  device?: ClockEventDevice
  geo?: ClockEventGeo
  location?: WorkLocation
  now?: Date
  employeeId?: string
  source?: ClockEventSource
}): AttendanceCommandResult {
  const state = getLastState(currentEvents)

  if (type === 'clock-in' && state !== 'not-working' && state !== 'finished') {
    throw new AttendanceCommandError('clock-in.invalid-state')
  }
  if (type === 'start-break' && state !== 'working') {
    throw new AttendanceCommandError('start-break.invalid-state')
  }
  if (type === 'resume-work' && state !== 'break') {
    throw new AttendanceCommandError('resume-work.invalid-state')
  }
  if (type === 'clock-out' && state !== 'working') {
    throw new AttendanceCommandError('clock-out.invalid-state')
  }

  const occurredAt = now.toISOString()
  const event: ClockEvent = {
    id: createId('clock-event'),
    employeeId,
    type,
    occurredAt,
    location: type === 'clock-in' ? (location ?? 'office') : undefined,
    source,
    device,
    geo,
    syncState: 'pending',
  }

  const operation: OutboxOperation = {
    id: createId('op'),
    type: 'clock-event.create',
    aggregate: 'clock-event',
    aggregateId: event.id,
    payload: event,
    clientCreatedAt: occurredAt,
    status: 'pending',
    attemptCount: 0,
  }

  return { event, operation }
}

export function createClockEventUpdateOperation(
  event: ClockEvent,
  now = new Date()
): OutboxOperation {
  return {
    id: createId('op'),
    type: 'clock-event.update',
    aggregate: 'clock-event',
    aggregateId: event.id,
    payload: event,
    clientCreatedAt: now.toISOString(),
    status: 'pending',
    attemptCount: 0,
  }
}

export function createClockEventDeleteOperation(
  event: ClockEvent,
  now = new Date()
): OutboxOperation {
  return {
    id: createId('op'),
    type: 'clock-event.delete',
    aggregate: 'clock-event',
    aggregateId: event.id,
    payload: {
      id: event.id,
      employeeId: event.employeeId,
      occurredAt: event.occurredAt,
      type: event.type,
    },
    clientCreatedAt: now.toISOString(),
    status: 'pending',
    attemptCount: 0,
  }
}

export function getBreakCompliance(projection: TodayProjection) {
  const requiredBreakMs =
    projection.workedMs > NINE_HOURS_MS
      ? FORTY_FIVE_MINUTES_MS
      : projection.workedMs > SIX_HOURS_MS
        ? THIRTY_MINUTES_MS
        : 0
  const missingBreakMs = Math.max(0, requiredBreakMs - projection.breakMs)
  const overMaxWorkMs = Math.max(0, projection.workedMs - TEN_HOURS_MS)

  return {
    isCompliant: missingBreakMs === 0 && overMaxWorkMs === 0,
    missingBreakMs,
    overMaxWorkMs,
    requiredBreakMs,
  }
}

export function createAttendanceTypeUpsertOperation(
  type: AttendanceStatusType,
  now = new Date()
): OutboxOperation {
  return {
    id: createId('op'),
    type: 'attendance-type.upsert',
    aggregate: 'attendance-type',
    aggregateId: type.id,
    payload: type,
    clientCreatedAt: now.toISOString(),
    status: 'pending',
    attemptCount: 0,
  }
}

export function createAttendanceTypeDeleteOperation(
  id: string,
  now = new Date()
): OutboxOperation {
  return {
    id: createId('op'),
    type: 'attendance-type.delete',
    aggregate: 'attendance-type',
    aggregateId: id,
    payload: { id },
    clientCreatedAt: now.toISOString(),
    status: 'pending',
    attemptCount: 0,
  }
}

export function createAttendancePolicyUpsertOperation(
  config: AttendancePolicyConfig,
  now = new Date()
): OutboxOperation {
  return {
    id: createId('op'),
    type: 'attendance-policy.upsert',
    aggregate: 'attendance-policy',
    aggregateId: config.id,
    payload: config,
    clientCreatedAt: now.toISOString(),
    status: 'pending',
    attemptCount: 0,
  }
}

export function makeAttendanceTypeId(code: string) {
  return `type-${code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}`
}

export function normalizeAttendanceTypeDraft(
  draft: Omit<AttendanceStatusType, 'id' | 'updatedAt'>,
  previous?: AttendanceStatusType
): AttendanceStatusType {
  const code = draft.code.trim().toUpperCase()

  return {
    id: previous?.id ?? makeAttendanceTypeId(code),
    ...draft,
    code,
    label: draft.label.trim(),
    updatedAt: new Date().toISOString(),
  }
}

export function buildTodayProjection(
  events: ClockEvent[],
  now = new Date()
): TodayProjection {
  const sorted = [...events].sort(
    (a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  )
  const state = getLastState(sorted)
  const location = getLastLocation(sorted)
  const { workedMs, breakMs } = getDurations(sorted, now)
  const lastBreak = [...sorted]
    .reverse()
    .find((event) => event.type === 'start-break')
  const lastClockOut = [...sorted]
    .reverse()
    .find((event) => event.type === 'clock-out')
  const firstClockIn = sorted.find((event) => event.type === 'clock-in')

  const timeline =
    sorted.length === 0
      ? [
          {
            id: 'empty',
            time: '--:--',
            label: 'timeline.empty',
            tone: 'muted' as const,
          },
        ]
      : sorted.map((event) => ({
          id: event.id,
          time: toTimeLabel(event.occurredAt),
          label: eventTimelineToken(event),
          tone:
            event.syncState === 'failed'
              ? ('warning' as const)
              : event.syncState === 'pending'
                ? ('muted' as const)
                : ('default' as const),
        }))

  return {
    state,
    location,
    startedAt: firstClockIn?.occurredAt,
    breakStartedAt: state === 'break' ? lastBreak?.occurredAt : undefined,
    finishedAt: lastClockOut?.occurredAt,
    workedMs,
    breakMs,
    flexMs: state === 'finished' ? workedMs - TARGET_WORK_MS : 0,
    timeline,
  }
}

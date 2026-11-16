import {
  attendanceGateway,
  loadMyClockEventsRange,
} from '@/data/api/attendance.gateway'
import { buildTodayProjection } from '@/domain/attendance/commands'
import type {
  ClockEvent,
  ClockEventDevice,
  ClockEventGeo,
  ClockEventType,
  WorkLocation,
} from '@/domain/attendance/types'

export type AttendanceWorkflowDependencies = {
  clock: (input: ClockAttendanceInput) => Promise<ClockEvent>
  correct: (event: ClockEvent, reason: string) => Promise<ClockEvent>
  createManual: (input: ManualClockAttendanceInput) => Promise<ClockEvent>
  listEventsForDay: (employeeId: string, day: Date) => Promise<ClockEvent[]>
  void: (event: ClockEvent, reason: string) => Promise<void>
}

export type ClockAttendanceInput = {
  day: Date
  employeeId: string
  type: ClockEventType
  device?: ClockEventDevice
  geo?: ClockEventGeo
  location?: WorkLocation
  now?: Date
}

export type ManualClockAttendanceInput = {
  employeeId: string
  geo?: ClockEventGeo
  location?: WorkLocation
  occurredAt: Date
  reason: string
  type: ClockEventType
}

export type ClosePreviousDayInput = {
  employeeId: string
  referenceDay: Date
  time: string
}

const defaultDependencies: AttendanceWorkflowDependencies = {
  clock: ({ device, employeeId, geo, location, type }) =>
    attendanceGateway.clock({
      clientEmployeeId: employeeId,
      device,
      geo,
      location,
      type,
    }),
  correct: attendanceGateway.correct,
  createManual: ({ employeeId, geo, location, occurredAt, reason, type }) =>
    attendanceGateway.createManual({
      clientEmployeeId: employeeId,
      geo,
      location,
      occurredAt,
      reason,
      type,
    }),
  listEventsForDay: (employeeId, day) => {
    const { fromInclusive, toExclusive } = dayBounds(day)

    return loadMyClockEventsRange({
      employeeId,
      fromInclusive,
      toExclusive,
    })
  },
  void: attendanceGateway.void,
}

export function createAttendanceWorkflowService(
  dependencies: AttendanceWorkflowDependencies = defaultDependencies
) {
  return {
    clock: (input: ClockAttendanceInput) => dependencies.clock(input),

    async updateEvent(event: ClockEvent, reason: string) {
      const nextEvent: ClockEvent = {
        ...event,
        source: 'manual',
      }

      return dependencies.correct(nextEvent, reason)
    },

    removeEvent: (event: ClockEvent, reason: string) =>
      dependencies.void(event, reason),

    async closePreviousDay({
      employeeId,
      referenceDay,
      time,
    }: ClosePreviousDayInput) {
      const previousDay = new Date(referenceDay)
      previousDay.setDate(previousDay.getDate() - 1)

      const currentEvents = await dependencies.listEventsForDay(
        employeeId,
        previousDay
      )
      const occurredAt = new Date(`${formatDate(previousDay)}T${time}:00`)
      const recoveryEvents = [...currentEvents]
      const createdEvents: ClockEvent[] = []
      const reason = 'Closed the previous open workday from Today.'

      if (buildTodayProjection(recoveryEvents, occurredAt).state === 'break') {
        const resumeAt = new Date(occurredAt.getTime() - 60_000)
        const resumeEvent = await dependencies.createManual({
          employeeId,
          occurredAt: resumeAt,
          reason,
          type: 'resume-work',
        })

        recoveryEvents.push(resumeEvent)
        createdEvents.push(resumeEvent)
      }

      const clockOutEvent = await dependencies.createManual({
        employeeId,
        occurredAt,
        reason,
        type: 'clock-out',
      })

      createdEvents.push(clockOutEvent)

      return createdEvents
    },
  }
}

function dayBounds(day: Date) {
  const fromInclusive = new Date(day)
  fromInclusive.setHours(0, 0, 0, 0)
  const toExclusive = new Date(fromInclusive)
  toExclusive.setDate(toExclusive.getDate() + 1)

  return { fromInclusive, toExclusive }
}

export const attendanceWorkflow = createAttendanceWorkflowService()

function formatDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

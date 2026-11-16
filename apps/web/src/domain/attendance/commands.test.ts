import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  AttendanceCommandError,
  buildTodayProjection,
  createClockCommand,
  getBreakCompliance,
} from './commands'
import type { ClockEvent } from './types'

function event(type: ClockEvent['type'], occurredAt: string): ClockEvent {
  return {
    id: `${type}-${occurredAt}`,
    employeeId: 'employee-1',
    occurredAt,
    source: 'user',
    syncState: 'synced',
    type,
  }
}

describe('attendance commands', () => {
  it('prevents impossible clock transitions', () => {
    const currentEvents = [event('clock-in', '2026-05-24T08:00:00.000Z')]

    assert.throws(
      () =>
        createClockCommand({
          currentEvents,
          now: new Date('2026-05-24T08:05:00.000Z'),
          type: 'clock-in',
        }),
      (error: unknown) =>
        error instanceof AttendanceCommandError &&
        error.code === 'clock-in.invalid-state'
    )
  })

  it('projects worked time and break time from ordered events', () => {
    const projection = buildTodayProjection(
      [
        event('clock-in', '2026-05-24T08:00:00.000Z'),
        event('start-break', '2026-05-24T12:00:00.000Z'),
        event('resume-work', '2026-05-24T12:30:00.000Z'),
        event('clock-out', '2026-05-24T16:30:00.000Z'),
      ],
      new Date('2026-05-24T16:30:00.000Z')
    )

    assert.equal(projection.state, 'finished')
    assert.equal(projection.workedMs, 8 * 60 * 60 * 1000)
    assert.equal(projection.breakMs, 30 * 60 * 1000)
    assert.equal(projection.flexMs, 0)
  })

  it('allows multiple flexible work sessions in one day', () => {
    const morning = [
      event('clock-in', '2026-05-24T08:00:00.000Z'),
      event('clock-out', '2026-05-24T12:00:00.000Z'),
    ]

    assert.doesNotThrow(() =>
      createClockCommand({
        currentEvents: morning,
        now: new Date('2026-05-24T14:00:00.000Z'),
        type: 'clock-in',
      })
    )

    const projection = buildTodayProjection(
      [
        ...morning,
        event('clock-in', '2026-05-24T14:00:00.000Z'),
        event('clock-out', '2026-05-24T18:00:00.000Z'),
      ],
      new Date('2026-05-24T18:00:00.000Z')
    )

    assert.equal(projection.state, 'finished')
    assert.equal(projection.workedMs, 8 * 60 * 60 * 1000)
    assert.equal(projection.timeline.length, 4)
  })

  it('flags missing legal break time after long workdays', () => {
    const projection = buildTodayProjection(
      [
        event('clock-in', '2026-05-24T08:00:00.000Z'),
        event('clock-out', '2026-05-24T15:00:00.000Z'),
      ],
      new Date('2026-05-24T15:00:00.000Z')
    )
    const compliance = getBreakCompliance(projection)

    assert.equal(compliance.isCompliant, false)
    assert.equal(compliance.requiredBreakMs, 30 * 60 * 1000)
    assert.equal(compliance.missingBreakMs, 30 * 60 * 1000)
  })
})

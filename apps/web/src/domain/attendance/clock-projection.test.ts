import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { foldClockEvents, msToHours } from './clock-projection'
import type { ClockEvent } from './types'

function event(
  type: ClockEvent['type'],
  time: string,
  location?: ClockEvent['location']
): ClockEvent {
  return {
    id: `${type}-${time}`,
    employeeId: 'emp-1',
    occurredAt: `2026-05-04T${time}:00.000Z`,
    type,
    location,
    source: 'user',
    syncState: 'synced',
  } as ClockEvent
}

describe('msToHours', () => {
  it('converts milliseconds to hours', () => {
    // The regression this guards: dividing by 36_000 instead of 3_600_000 reported an
    // eight and a half hour day as 850, inflating every payroll figure a hundredfold.
    assert.equal(msToHours(8.5 * 3_600_000), 8.5)
    assert.equal(msToHours(3_600_000), 1)
    assert.equal(msToHours(0), 0)
  })

  it('rounds to two decimals', () => {
    assert.equal(msToHours(1_000), 0)
    assert.equal(msToHours(3_600_000 / 3), 0.33)
  })
})

describe('foldClockEvents', () => {
  it('returns an empty projection for no events', () => {
    const projection = foldClockEvents([])

    assert.equal(projection.workedMs, 0)
    assert.equal(projection.breakMs, 0)
    assert.equal(projection.firstInAt, undefined)
    assert.equal(projection.lastOutAt, undefined)
    assert.equal(projection.hasOpenShift, false)
  })

  it('accumulates a plain shift', () => {
    const projection = foldClockEvents([
      event('clock-in', '08:00'),
      event('clock-out', '16:30'),
    ])

    assert.equal(msToHours(projection.workedMs), 8.5)
    assert.equal(msToHours(projection.breakMs), 0)
    assert.equal(projection.firstInAt, '2026-05-04T08:00:00.000Z')
    assert.equal(projection.lastOutAt, '2026-05-04T16:30:00.000Z')
  })

  it('excludes break time from worked time', () => {
    const projection = foldClockEvents([
      event('clock-in', '08:00'),
      event('start-break', '12:00'),
      event('resume-work', '12:30'),
      event('clock-out', '17:00'),
    ])

    assert.equal(msToHours(projection.workedMs), 8.5)
    assert.equal(msToHours(projection.breakMs), 0.5)
  })

  it('closes an open break at clock-out', () => {
    const projection = foldClockEvents([
      event('clock-in', '08:00'),
      event('start-break', '12:00'),
      event('clock-out', '12:30'),
    ])

    assert.equal(msToHours(projection.workedMs), 4)
    assert.equal(msToHours(projection.breakMs), 0.5)
  })

  it('sorts events, so storage order cannot change the totals', () => {
    const ordered = foldClockEvents([
      event('clock-in', '08:00'),
      event('clock-out', '16:00'),
    ])
    const shuffled = foldClockEvents([
      event('clock-out', '16:00'),
      event('clock-in', '08:00'),
    ])

    assert.equal(shuffled.workedMs, ordered.workedMs)
  })

  it('reports a shift left open', () => {
    const projection = foldClockEvents([event('clock-in', '08:00')])

    assert.equal(projection.hasOpenShift, true)
    assert.equal(projection.workedMs, 0)
    assert.equal(projection.lastOutAt, undefined)
  })

  it('takes the last clock-out when a day has several shifts', () => {
    const projection = foldClockEvents([
      event('clock-in', '08:00'),
      event('clock-out', '12:00'),
      event('clock-in', '13:00'),
      event('clock-out', '17:00'),
    ])

    assert.equal(msToHours(projection.workedMs), 8)
    assert.equal(projection.firstInAt, '2026-05-04T08:00:00.000Z')
    assert.equal(projection.lastOutAt, '2026-05-04T17:00:00.000Z')
  })

  it('carries the work location forward until an event changes it', () => {
    const projection = foldClockEvents([
      event('clock-in', '08:00', 'home-office'),
      event('start-break', '12:00'),
      event('resume-work', '12:30'),
      event('clock-out', '17:00'),
    ])

    assert.ok(
      projection.transitions.every(
        (transition) => transition.location === 'home-office'
      )
    )
  })

  it('marks which interval each transition closed', () => {
    const projection = foldClockEvents([
      event('clock-in', '08:00'),
      event('start-break', '12:00'),
      event('resume-work', '12:30'),
      event('clock-out', '17:00'),
    ])

    assert.deepEqual(
      projection.transitions.map((t) => [t.closedWork, t.closedBreak]),
      [
        [false, false],
        [true, false],
        [false, true],
        [true, false],
      ]
    )
  })

  it('ignores a stray clock-out with no open shift', () => {
    const projection = foldClockEvents([event('clock-out', '17:00')])

    assert.equal(projection.workedMs, 0)
    assert.equal(projection.hasOpenShift, false)
  })
})

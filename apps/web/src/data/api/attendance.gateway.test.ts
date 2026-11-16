import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildOfflineClockCommand,
  shouldFallbackToLocalAttendance,
} from './attendance.gateway'
import { FlowProApiError } from './http-client'

describe('attendance gateway offline fallback', () => {
  it('creates a pending local clock command when backend clock-in is unavailable', () => {
    const { event, operation } = buildOfflineClockCommand({
      currentEvents: [],
      input: {
        clientEmployeeId: 'employee-1',
        device: { label: 'Browser', type: 'browser' },
        location: 'home-office',
        type: 'clock-in',
      },
      now: new Date('2026-06-14T08:00:00.000Z'),
    })

    assert.equal(event.employeeId, 'employee-1')
    assert.equal(event.location, 'home-office')
    assert.equal(event.occurredAt, '2026-06-14T08:00:00.000Z')
    assert.equal(event.source, 'user')
    assert.equal(event.syncState, 'pending')
    assert.equal(event.type, 'clock-in')

    assert.equal(operation.aggregate, 'clock-event')
    assert.equal(operation.aggregateId, event.id)
    assert.equal(operation.payload, event)
    assert.equal(operation.status, 'pending')
    assert.equal(operation.type, 'clock-event.create')
  })

  it('keeps invalid local clock transitions blocked during fallback', () => {
    assert.throws(
      () =>
        buildOfflineClockCommand({
          currentEvents: [
            {
              employeeId: 'employee-1',
              id: 'clock-event-1',
              occurredAt: '2026-06-14T08:00:00.000Z',
              source: 'user',
              syncState: 'pending',
              type: 'clock-in',
            },
          ],
          input: {
            clientEmployeeId: 'employee-1',
            type: 'clock-in',
          },
          now: new Date('2026-06-14T08:05:00.000Z'),
        }),
      { name: 'AttendanceCommandError' }
    )
  })

  it('falls back only for unavailable backend failures', () => {
    assert.equal(
      shouldFallbackToLocalAttendance(
        new FlowProApiError('FlowPro API is unavailable.')
      ),
      true
    )
    assert.equal(
      shouldFallbackToLocalAttendance(
        new FlowProApiError('Server failed.', 'server.unexpected', 500)
      ),
      true
    )
    assert.equal(
      shouldFallbackToLocalAttendance(
        new FlowProApiError(
          'Managing timesheets requires permission.',
          'attendance.forbidden',
          403
        )
      ),
      false
    )
    assert.equal(
      shouldFallbackToLocalAttendance(
        new FlowProApiError(
          'Clock transition is invalid.',
          'attendance.clock-in.invalid-state',
          409
        )
      ),
      false
    )
    assert.equal(shouldFallbackToLocalAttendance(new Error('boom')), false)
  })
})

import { createClockCommand } from '@/domain/attendance/commands'
import type { OutboxOperation } from '@/domain/attendance/types'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  BACKEND_SYNCABLE_AGGREGATES,
  DEFAULT_CLOCK_EVENT_REPLAY_ERROR,
  resolveClockEventReplayFailure,
  resolveClockEventReplayOutcome,
  shouldReplayThroughAttendanceApi,
} from './protocol'

/**
 * Guards the boundary between the two backend write channels:
 *
 *  - /api/v1/attendance/commands/*  — authoritative, advisory-locked, idempotent.
 *  - /api/v1/sync/batches           — generic, last-writer-wins client aggregates.
 *
 * Offline clock events must travel over the first channel. The server rejects
 * `clock-event` writes on the second one, and has a committed test for it
 * (SyncCommandHandlerTests.RejectsGenericClockEventWritesBecauseAttendanceApiIsAuthoritative),
 * so routing them there would strand every offline clock-in in a permanent
 * failed-retry loop and never reach Postgres.
 */
const requestOperation: OutboxOperation = {
  id: 'op-request-1',
  aggregate: 'request',
  aggregateId: 'req-1',
  attemptCount: 0,
  clientCreatedAt: '2026-06-14T08:00:00.000Z',
  payload: { id: 'req-1' },
  status: 'pending',
  type: 'request.submit',
}

describe('offline attendance sync contract', () => {
  it('replays offline clock events through the authoritative attendance API, not the sync batch', () => {
    // The offline fallback (attendanceGateway.clock) builds this exact operation.
    const { operation } = createClockCommand({
      currentEvents: [],
      employeeId: 'employee-1',
      location: 'office',
      now: new Date('2026-06-14T08:00:00.000Z'),
      type: 'clock-in',
    })

    assert.equal(operation.aggregate, 'clock-event')
    assert.equal(operation.type, 'clock-event.create')

    // Must be replayed through /attendance/commands/*, and must never be offered
    // to the generic sync batch that the server rejects.
    assert.equal(shouldReplayThroughAttendanceApi(operation), true)
    assert.equal(BACKEND_SYNCABLE_AGGREGATES.has(operation.aggregate), false)
  })

  it('keeps backend-syncable aggregates on the generic sync batch', () => {
    assert.equal(shouldReplayThroughAttendanceApi(requestOperation), false)
    assert.equal(
      BACKEND_SYNCABLE_AGGREGATES.has(requestOperation.aggregate),
      true
    )
  })
})

/**
 * These cover the state transitions the sync engine applies after replaying an
 * offline clock event. Attendance bookings are payroll and legal evidence, so
 * each outcome has to leave the outbox and the cached booking in a state the
 * user can see and act on — never silently dropped, never retried forever.
 */
describe('offline clock event replay resolution', () => {
  it('marks a server-accepted replay as synced and continues the drain', () => {
    const resolution = resolveClockEventReplayOutcome({
      status: 'synced',
      syncedAt: '2026-06-14T08:00:00.000Z',
    })

    assert.equal(resolution.operationStatus, 'synced')
    assert.equal(resolution.syncedAt, '2026-06-14T08:00:00.000Z')
    assert.equal(resolution.lastError, undefined)
    // The gateway already reconciled the cached booking to the canonical one.
    assert.equal(resolution.eventSyncState, undefined)
    assert.equal(resolution.stopProcessing, false)
  })

  it('cancels a terminally rejected replay instead of retrying forever', () => {
    const resolution = resolveClockEventReplayOutcome({
      message: 'attendance.clock-in.invalid-state',
      status: 'rejected',
    })

    // Cancelled, not failed: the server will never accept this operation, so
    // leaving it retryable would loop indefinitely and hide the problem.
    assert.equal(resolution.operationStatus, 'cancelled')
    assert.equal(resolution.lastError, 'attendance.clock-in.invalid-state')
    // The booking stays visible to the user rather than disappearing silently.
    assert.equal(resolution.eventSyncState, 'failed')
    // A dead operation must not block the remaining queue.
    assert.equal(resolution.stopProcessing, false)
    assert.equal(resolution.syncedAt, undefined)
  })

  it('keeps a transient failure retryable and stops the drain', () => {
    const resolution = resolveClockEventReplayFailure(
      new Error('FlowPro API is unavailable.')
    )

    // Failed (not cancelled) so the next tick picks it up again.
    assert.equal(resolution.operationStatus, 'failed')
    assert.equal(resolution.lastError, 'FlowPro API is unavailable.')
    assert.equal(resolution.eventSyncState, 'failed')
    // Stop the loop rather than hammering an unreachable backend.
    assert.equal(resolution.stopProcessing, true)
    assert.equal(resolution.syncedAt, undefined)
  })

  it('falls back to a readable message for non-Error failures', () => {
    const resolution = resolveClockEventReplayFailure('socket hang up')

    assert.equal(resolution.lastError, DEFAULT_CLOCK_EVENT_REPLAY_ERROR)
    assert.equal(resolution.operationStatus, 'failed')
    assert.equal(resolution.stopProcessing, true)
  })

  it('never reports a replay as synced unless the server accepted it', () => {
    const notSynced = [
      resolveClockEventReplayOutcome({ message: 'nope', status: 'rejected' }),
      resolveClockEventReplayFailure(new Error('offline')),
    ]

    for (const resolution of notSynced) {
      assert.notEqual(
        resolution.operationStatus,
        'synced',
        'an unconfirmed booking must never be recorded as synced'
      )
      assert.equal(resolution.syncedAt, undefined)
    }
  })
})

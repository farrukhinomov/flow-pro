import type { SyncState, TodayProjection } from '@/domain/attendance/types'
import type { EmployeeRequest } from '@/domain/requests/types'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canEditClockEvent,
  eventDateTimeValue,
  formatDuration,
  formatSignedDuration,
  getOpenRequests,
  getRequestDetails,
  getStateMetrics,
  getWorkStateCopy,
} from './today-view-model'

function localIso(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute = 0
) {
  return new Date(year, monthIndex, day, hour, minute).toISOString()
}

function projection(overrides: Partial<TodayProjection> = {}): TodayProjection {
  return {
    breakMs: 0,
    flexMs: 0,
    location: 'office',
    state: 'not-working',
    timeline: [
      {
        id: 'empty',
        label: 'No booking yet. Clock in to start the timeline.',
        time: '--:--',
        tone: 'muted',
      },
    ],
    workedMs: 0,
    ...overrides,
  }
}

function request(overrides: Partial<EmployeeRequest> = {}): EmployeeRequest {
  return {
    employeeId: 'employee-1',
    employeeName: 'Hannah Fischer',
    fromDate: '2026-05-04',
    id: 'request-1',
    kind: 'absence',
    status: 'submitted',
    statusCode: 'VAC',
    statusLabel: 'Vacation',
    submittedAt: '2026-05-01T08:00:00.000Z',
    subtype: 'Vacation',
    syncState: 'synced',
    toDate: '2026-05-05',
    updatedAt: '2026-05-01T09:00:00.000Z',
    ...overrides,
  }
}

describe('today view model', () => {
  it('formats durations and local datetime values', () => {
    assert.equal(formatDuration(0), '00:00')
    assert.equal(formatDuration(3_660_000), '01:01')
    assert.equal(formatDuration(-5_000), '00:00')
    assert.equal(formatSignedDuration(900_000), '+00:15')
    assert.equal(formatSignedDuration(-3_600_000), '-01:00')
    assert.equal(
      eventDateTimeValue(localIso(2026, 4, 25, 8, 13)),
      '2026-05-25T08:13'
    )
  })

  it('describes the current work state without UI dependencies', () => {
    assert.equal(
      getWorkStateCopy(projection(), 'Hannah').greeting,
      'Good morning, Hannah'
    )
    assert.equal(
      getWorkStateCopy(
        projection({
          startedAt: localIso(2026, 4, 25, 8, 13),
          state: 'working',
        }),
        'Hannah'
      ).status,
      'Working · Started 08:13'
    )
    assert.equal(
      getWorkStateCopy(
        projection({ breakMs: 18 * 60_000, state: 'break' }),
        'Hannah'
      ).status,
      'On break · 00:18'
    )
  })

  it('builds state metrics only from projection data', () => {
    assert.deepEqual(
      getStateMetrics(projection()).map((metric) => metric.value),
      ['00:00', '00:00', 'Office']
    )
    assert.deepEqual(
      getStateMetrics(
        projection({
          breakMs: 30 * 60_000,
          flexMs: 15 * 60_000,
          state: 'finished',
          workedMs: 8 * 60 * 60_000 + 15 * 60_000,
        })
      ).map((metric) => metric.value),
      ['08:15', '+00:15', '00:30']
    )
  })

  it('formats request details for absence and booking corrections', () => {
    assert.equal(
      getRequestDetails(request()),
      'Vacation · 04/05/2026 - 05/05/2026'
    )
    assert.equal(
      getRequestDetails(
        request({
          clockIn: '08:00',
          clockOut: '16:30',
          kind: 'booking-correction',
          subtype: 'Missing clock out',
        })
      ),
      'In 08:00 · Out 16:30'
    )
  })

  it('only allows corrections on server-synced bookings', () => {
    assert.equal(canEditClockEvent({ syncState: 'synced' }), true)

    const blockedStates: SyncState[] = [
      'local',
      'pending',
      'syncing',
      'failed',
      'conflict',
      'cancelled',
    ]
    for (const syncState of blockedStates) {
      assert.equal(
        canEditClockEvent({ syncState }),
        false,
        `${syncState} bookings must not be editable`
      )
    }
  })

  it('returns the latest submitted requests for one employee', () => {
    const visible = getOpenRequests({
      employeeId: 'employee-1',
      requests: [
        request({ id: 'old', submittedAt: '2026-05-01T08:00:00.000Z' }),
        request({ id: 'approved', status: 'approved' }),
        request({ employeeId: 'employee-2', id: 'other-user' }),
        request({ id: 'newest', submittedAt: '2026-05-03T08:00:00.000Z' }),
        request({ id: 'middle', submittedAt: '2026-05-02T08:00:00.000Z' }),
      ],
    })

    assert.deepEqual(
      visible.map((item) => item.id),
      ['newest', 'middle', 'old']
    )
  })
})

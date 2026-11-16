import type { ClockEvent, WorkContract } from '@/domain/attendance/types'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildEmployeeTimesheetRows } from './timesheet-projection'

const workContract: WorkContract = {
  id: 'contract-employee-1',
  dailyHours: {
    1: 6,
    2: 6,
    3: 6,
    4: 6,
    5: 6,
  },
  effectiveFrom: '2026-01-01',
  employeeId: 'employee-1',
  weeklyHours: 30,
  workdays: [1, 2, 3, 4, 5],
}

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

describe('timesheet projection', () => {
  it('builds the canonical rows used by Timesheet and Today', () => {
    const rows = buildEmployeeTimesheetRows({
      corrections: [
        {
          approvedAt: '2026-06-03T18:00:00.000Z',
          approvedById: 'manager-1',
          approvedByName: 'Manager One',
          clockIn: '08:30',
          clockOut: '15:00',
          createdAt: '2026-06-03T18:00:00.000Z',
          date: '2026-06-03',
          employeeId: 'employee-1',
          id: 'correction-1',
          requestId: 'request-1',
        },
      ],
      employeeId: 'employee-1',
      events: [
        event('clock-in', '2026-06-03T08:00:00.000Z'),
        event('clock-out', '2026-06-03T14:00:00.000Z'),
      ],
      locale: 'en',
      periodMonth: '2026-06',
      requests: [
        {
          employeeId: 'employee-1',
          employeeName: 'Employee One',
          fromDate: '2026-06-04',
          id: 'absence-1',
          kind: 'absence',
          status: 'approved',
          statusCode: 'VAC',
          submittedAt: '2026-05-01T08:00:00.000Z',
          subtype: 'Vacation',
          syncState: 'synced',
          toDate: '2026-06-04',
          updatedAt: '2026-05-02T08:00:00.000Z',
        },
      ],
      workContract,
    })

    const corrected = rows.find((row) => row.date === '2026-06-03')
    const absent = rows.find((row) => row.date === '2026-06-04')

    assert.deepEqual(corrected?.clockIns, ['08:30'])
    assert.deepEqual(corrected?.clockOuts, ['15:00'])
    assert.equal(corrected?.target, 6)
    assert.equal(corrected?.total, 6.5)
    assert.equal(corrected?.flex, 0.5)
    assert.deepEqual(absent?.absences, ['VAC'])
    assert.equal(absent?.target, 6)
    assert.equal(absent?.paid, 6)
    assert.equal(absent?.total, 6)
  })
})

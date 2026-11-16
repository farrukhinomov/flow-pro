import type { ClockEvent, WorkContract } from '@/domain/attendance/types'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getTimelineSegments } from './timesheet-timeline'
import {
  applyApprovedAbsencesToRows,
  applyCorrectionToDay,
  createMonthRows,
  getDayBadges,
  getTimesheetMetrics,
  mergeRowsWithClockEvents,
  projectClockEventsToDay,
  selectElapsedRows,
} from './timesheet-view-model'
import type { DayRow } from './types'

const workContract: WorkContract = {
  id: 'contract-employee-1',
  dailyHours: {
    1: 8,
    2: 8,
    3: 8,
    4: 8,
    5: 8,
  },
  effectiveFrom: '2026-01-01',
  employeeId: 'employee-1',
  weeklyHours: 40,
  workdays: [1, 2, 3, 4, 5],
}

const baseRow: DayRow = {
  absences: [],
  clockIns: [],
  clockOuts: [],
  date: '2026-05-04',
  isHoliday: false,
  isWeekend: false,
  label: '04/05 Mon',
  target: 8,
}

function event(
  type: ClockEvent['type'],
  occurredAt: string,
  location?: ClockEvent['location']
): ClockEvent {
  return {
    id: `${type}-${occurredAt}`,
    employeeId: 'employee-1',
    location,
    occurredAt,
    source: 'user',
    syncState: 'synced',
    type,
  }
}

function localIso(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute = 0
) {
  return new Date(year, monthIndex, day, hour, minute).toISOString()
}

describe('timesheet view model', () => {
  it('creates month rows from work contracts and public holidays', () => {
    const rows = createMonthRows('2026-05', workContract)
    const mayFirst = rows.find((row) => row.date === '2026-05-01')
    const saturday = rows.find((row) => row.date === '2026-05-02')

    assert.equal(rows.length, 31)
    assert.equal(mayFirst?.isHoliday, true)
    assert.equal(mayFirst?.total, 8)
    assert.equal(saturday?.isWeekend, true)
    assert.equal(saturday?.target, undefined)
  })

  it('projects flexible clock sessions and breaks into one day', () => {
    const row = projectClockEventsToDay(baseRow, [
      event('clock-in', localIso(2026, 4, 4, 8), 'office'),
      event('start-break', localIso(2026, 4, 4, 12)),
      event('resume-work', localIso(2026, 4, 4, 12, 30)),
      event('clock-out', localIso(2026, 4, 4, 16, 30)),
      event('clock-in', localIso(2026, 4, 4, 18), 'home-office'),
      event('clock-out', localIso(2026, 4, 4, 19)),
    ])

    assert.deepEqual(row.clockIns, ['08:00', '12:30', '18:00'])
    assert.deepEqual(row.clockOuts, ['12:00 Pa', '16:30', '19:00 HO'])
    assert.equal(row.total, 9)
    assert.equal(row.breakTaken, 0.5)
    assert.equal(row.flex, 1)
    assert.deepEqual(row.absences, ['HO'])
  })

  it('builds timeline segments with separate breaks and overtime', () => {
    const row = projectClockEventsToDay(baseRow, [
      event('clock-in', localIso(2026, 4, 4, 8), 'office'),
      event('start-break', localIso(2026, 4, 4, 12)),
      event('resume-work', localIso(2026, 4, 4, 12, 30)),
      event('clock-out', localIso(2026, 4, 4, 17)),
    ])
    const segments = getTimelineSegments(row)

    assert.deepEqual(
      segments.map((segment) => ({
        end: segment.end,
        start: segment.start,
        tone: segment.tone,
      })),
      [
        { end: '12:00', start: '08:00', tone: 'work' },
        { end: '12:30', start: '12:00', tone: 'break' },
        { end: '16:30', start: '12:30', tone: 'work' },
        { end: '17:00', start: '16:30', tone: 'overtime' },
      ]
    )
  })

  it('does not render zero-duration timeline segments', () => {
    const segments = getTimelineSegments({
      ...baseRow,
      clockIns: ['08:00', '12:00', '12:30'],
      clockOuts: ['12:00 Pa', '12:00 Pa', '17:00'],
    })

    assert.deepEqual(
      segments.map((segment) => ({
        end: segment.end,
        start: segment.start,
        tone: segment.tone,
      })),
      [
        { end: '12:00', start: '08:00', tone: 'work' },
        { end: '12:30', start: '12:00', tone: 'break' },
        { end: '17:00', start: '12:30', tone: 'work' },
      ]
    )
  })

  it('uses the latest approved correction for a day', () => {
    const rows = mergeRowsWithClockEvents({
      baseRows: [baseRow],
      corrections: [
        {
          approvedAt: '2026-05-04T18:00:00.000Z',
          approvedById: 'manager-1',
          approvedByName: 'Manager One',
          clockIn: '09:00',
          clockOut: '17:00',
          createdAt: '2026-05-04T18:00:00.000Z',
          date: '2026-05-04',
          employeeId: 'employee-1',
          id: 'correction-1',
          requestId: 'request-1',
        },
        {
          approvedAt: '2026-05-04T19:00:00.000Z',
          approvedById: 'manager-1',
          approvedByName: 'Manager One',
          clockIn: '08:30',
          clockOut: '17:00',
          createdAt: '2026-05-04T19:00:00.000Z',
          date: '2026-05-04',
          employeeId: 'employee-1',
          id: 'correction-2',
          requestId: 'request-2',
        },
      ],
      events: [],
      periodMonth: '2026-05',
    })

    assert.equal(rows[0]?.clockIns[0], '08:30')
    assert.equal(rows[0]?.total, 8.5)
  })

  it('applies approved absences and exposes exception badges', () => {
    const [row] = applyApprovedAbsencesToRows({
      baseRows: [baseRow],
      employeeId: 'employee-1',
      periodMonth: '2026-05',
      requests: [
        {
          employeeId: 'employee-1',
          employeeName: 'Employee One',
          fromDate: '2026-05-04',
          id: 'request-1',
          kind: 'absence',
          status: 'approved',
          statusCode: 'HO',
          submittedAt: '2026-05-01T08:00:00.000Z',
          subtype: 'Home office',
          syncState: 'synced',
          toDate: '2026-05-04',
          updatedAt: '2026-05-01T09:00:00.000Z',
        },
      ],
    })

    assert.deepEqual(row?.absences, ['HO'])
    assert.deepEqual(
      getDayBadges(
        {
          ...row!,
          clockIns: [],
        },
        '2026-05-05'
      ).map((badge) => badge.labelKey),
      ['timesheetUi.badges.homeOffice', 'timesheetUi.badges.missing']
    )
  })

  it('calculates period metrics from rows', () => {
    const metrics = getTimesheetMetrics([
      { ...baseRow, breakTaken: 0.5, flex: 1, paid: 9, prod: 9, total: 9 },
      { ...baseRow, date: '2026-05-05', flex: -1, paid: 7, prod: 7, total: 7 },
    ])

    assert.deepEqual(metrics, {
      breaks: 0.5,
      flex: 0,
      paid: 16,
      target: 16,
      worked: 16,
    })
  })

  it('measures an in-progress period only up to today', () => {
    const now = new Date(2026, 4, 5, 12) // 5 May 2026, mid-period
    const rows: DayRow[] = [
      { ...baseRow, date: '2026-05-04', flex: 0, paid: 8, prod: 8, total: 8 },
      { ...baseRow, date: '2026-05-05', flex: 0, paid: 8, prod: 8, total: 8 },
      // Still to come: scheduled, but nothing can have been worked yet.
      { ...baseRow, date: '2026-05-06' },
      { ...baseRow, date: '2026-05-07' },
    ]

    const elapsed = selectElapsedRows(rows, '2026-05', now)

    assert.deepEqual(
      elapsed.map((row) => row.date),
      ['2026-05-04', '2026-05-05']
    )

    // Across the whole month the two headline figures describe different
    // windows: worked stops at today, target runs to month end. Someone exactly
    // on plan still appears 16 hours short.
    const wholeMonth = getTimesheetMetrics(rows)
    assert.equal(wholeMonth.worked, 16)
    assert.equal(wholeMonth.target, 32)

    // Measured over the same window, the comparison is like-for-like.
    const toDate = getTimesheetMetrics(elapsed)
    assert.equal(toDate.worked, 16)
    assert.equal(toDate.target, 16)
  })

  it('leaves a completed period fully counted', () => {
    const now = new Date(2026, 5, 15, 12) // June, looking back at May
    const rows: DayRow[] = [
      { ...baseRow, date: '2026-05-04' },
      { ...baseRow, date: '2026-05-29' },
    ]

    assert.deepEqual(selectElapsedRows(rows, '2026-05', now), rows)
  })

  it('applies manual corrections directly to the display row', () => {
    const row = applyCorrectionToDay(baseRow, {
      approvedAt: '2026-05-04T18:00:00.000Z',
      approvedById: 'manager-1',
      approvedByName: 'Manager One',
      clockIn: '09:00',
      clockOut: '17:30',
      createdAt: '2026-05-04T18:00:00.000Z',
      date: '2026-05-04',
      employeeId: 'employee-1',
      id: 'correction-1',
      requestId: 'request-1',
    })

    assert.deepEqual(row.clockIns, ['09:00'])
    assert.deepEqual(row.clockOuts, ['17:30'])
    assert.equal(row.total, 8.5)
    assert.equal(row.flex, 0.5)
  })

  it('replaces a day with an approved proposed event timeline', () => {
    const row = applyCorrectionToDay(baseRow, {
      approvedAt: '2026-05-04T18:00:00.000Z',
      approvedById: 'manager-1',
      approvedByName: 'Manager One',
      createdAt: '2026-05-04T18:00:00.000Z',
      date: '2026-05-04',
      employeeId: 'employee-1',
      id: 'correction-1',
      proposedEvents: [
        {
          id: 'in',
          location: 'home-office',
          occurredAt: localIso(2026, 4, 4, 8),
          type: 'clock-in',
        },
        {
          id: 'break',
          occurredAt: localIso(2026, 4, 4, 12),
          type: 'start-break',
        },
        {
          id: 'resume',
          location: 'office',
          occurredAt: localIso(2026, 4, 4, 12, 30),
          type: 'resume-work',
        },
        {
          id: 'out',
          occurredAt: localIso(2026, 4, 4, 17),
          type: 'clock-out',
        },
      ],
      requestId: 'request-1',
    })

    assert.deepEqual(row.clockIns, ['08:00', '12:30'])
    assert.deepEqual(row.clockOuts, ['12:00 HO', '17:00'])
    assert.equal(row.breakTaken, 0.5)
    assert.equal(row.total, 8.5)
    assert.deepEqual(row.absences, ['HO'])
  })
})

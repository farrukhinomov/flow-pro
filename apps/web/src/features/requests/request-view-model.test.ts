import type { AppViewer } from '@/domain/access/access-control'
import type { AttendanceStatusType } from '@/domain/attendance/types'
import type { EmployeeRequest } from '@/domain/requests/types'
import type { EmployeeUser } from '@/domain/users/types'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyDecisionToRequests,
  buildRequestDraftPreview,
  buildRequestRows,
  calcBusinessDays,
  canSubmitRequestDraft,
  filterApprovalRows,
  filterHistoryRows,
  formatFileSize,
  formatPartialDay,
  getApprovalEmployees,
  getApprovalRows,
  getHistoryRows,
  mapRequestKind,
} from './request-view-model'

const viewer: AppViewer = {
  employeeId: 'manager-1',
  id: 'viewer-manager-1',
  managedTeam: 'Support',
  name: 'Maja Manager',
  role: 'manager',
}

function user(overrides: Partial<EmployeeUser>): EmployeeUser {
  return {
    createdAt: new Date('2026-01-01T08:00:00.000Z'),
    email: 'employee@example.com',
    firstName: 'Hannah',
    id: 'employee-1',
    lastName: 'Fischer',
    manager: 'Maja Manager',
    phoneNumber: '+49 30 000000',
    role: 'employee',
    status: 'active',
    team: 'Support',
    updatedAt: new Date('2026-01-01T08:00:00.000Z'),
    username: 'hannah.fischer',
    visibilityScope: 'team',
    workPattern: 'Full-time',
    ...overrides,
  }
}

const employees: EmployeeUser[] = [
  user({
    email: 'manager@example.com',
    firstName: 'Maja',
    id: 'manager-1',
    lastName: 'Manager',
    role: 'manager',
    username: 'maja.manager',
  }),
  user({}),
  user({
    email: 'sales@example.com',
    firstName: 'Sven',
    id: 'employee-2',
    lastName: 'Sales',
    team: 'Sales',
    username: 'sven.sales',
  }),
]

const vacationType: AttendanceStatusType = {
  adminVisibility: 'full',
  auditRequired: true,
  category: 'leave',
  code: 'VAC',
  color: '#0ea5e9',
  id: 'type-vacation',
  label: 'Vacation',
  managerVisibility: 'operational',
  requiresApproval: true,
  teammateVisibility: 'state-only',
  updatedAt: '2026-05-01T08:00:00.000Z',
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
    statusTypeId: 'type-vacation',
    submittedAt: '2026-05-01T08:00:00.000Z',
    subtype: 'Vacation',
    syncState: 'synced',
    toDate: '2026-05-05',
    updatedAt: '2026-05-01T08:00:00.000Z',
    ...overrides,
  }
}

describe('request view model', () => {
  it('counts only working days in an absence range', () => {
    // 2026-05: 02 Sat, 03 Sun, 04 Mon, 08 Fri, 09 Sat, 11 Mon
    assert.equal(calcBusinessDays('2026-05-04', '2026-05-08'), 5) // Mon-Fri
    assert.equal(calcBusinessDays('2026-05-04', '2026-05-04'), 1) // single weekday
    assert.equal(calcBusinessDays('2026-05-08', '2026-05-11'), 2) // Fri + Mon
    assert.equal(calcBusinessDays('2026-05-02', '2026-05-04'), 1) // weekend + Mon

    // Ranges without a single working day previously reported "1 day".
    assert.equal(calcBusinessDays('2026-05-02', '2026-05-02'), 0) // Sat only
    assert.equal(calcBusinessDays('2026-05-02', '2026-05-03'), 0) // whole weekend

    // Invalid input stays at zero rather than throwing.
    assert.equal(calcBusinessDays('2026-05-08', '2026-05-04'), 0) // reversed
    assert.equal(calcBusinessDays('', '2026-05-04'), 0)
  })

  it('requires a time window for a partial official absence', () => {
    const draft = {
      bookingType: 'pair',
      fromDate: '2026-05-04',
      hasBlockingPolicyIssue: false,
      kind: 'official' as const,
      selectedAbsenceType: undefined,
      singleDate: '2026-05-04',
      toDate: '2026-05-04',
    }

    // A complete day needs no times.
    assert.equal(
      canSubmitRequestDraft({
        ...draft,
        clockIn: '',
        clockOut: '',
        officialType: 'full-day',
      }),
      true
    )

    // The form shows both time inputs for a partial absence, so both are needed.
    assert.equal(
      canSubmitRequestDraft({
        ...draft,
        clockIn: '',
        clockOut: '',
        officialType: 'before-start',
      }),
      false
    )
    assert.equal(
      canSubmitRequestDraft({
        ...draft,
        clockIn: '08:00',
        clockOut: '',
        officialType: 'after-end',
      }),
      false
    )
    assert.equal(
      canSubmitRequestDraft({
        ...draft,
        clockIn: '08:00',
        clockOut: '10:00',
        officialType: 'after-end',
      }),
      true
    )
  })

  it('formats request helper values consistently', () => {
    assert.equal(calcBusinessDays('2026-05-04', '2026-05-08'), 5)
    assert.equal(formatFileSize(512), '512 B')
    assert.equal(formatFileSize(2048), '2 KB')
    assert.equal(
      formatPartialDay({ partialDay: { mode: 'morning' } }),
      'Morning'
    )
    assert.equal(
      formatPartialDay({
        partialDay: {
          endTime: '12:30',
          mode: 'custom',
          startTime: '09:00',
        },
      }),
      'Custom hours · 09:00 - 12:30'
    )
  })

  it('maps UI request kinds to backend request kinds', () => {
    assert.equal(mapRequestKind('absence'), 'absence')
    assert.equal(mapRequestKind('booking'), 'booking-correction')
    assert.equal(mapRequestKind('official'), 'official-absence')
  })

  it('builds a draft preview with the current viewer identity', () => {
    const draft = buildRequestDraftPreview({
      attachments: [],
      bookingType: 'pair',
      clockIn: '',
      clockOut: '',
      fromDate: '2026-05-04',
      kind: 'absence',
      officialType: 'full-day',
      partialDayMode: 'custom',
      partialEndTime: '12:00',
      partialStartTime: '08:00',
      recurrenceFrequency: 'weekly',
      recurrenceOccurrences: 3,
      remark: 'Family appointment',
      selectedAbsenceType: {
        code: 'VAC',
        label: 'Vacation',
        value: 'type-vacation',
      },
      singleDate: '2026-05-04',
      toDate: '2026-05-04',
      viewer,
    })

    assert.equal(draft.employeeId, 'manager-1')
    assert.equal(draft.employeeName, 'Maja Manager')
    assert.equal(draft.kind, 'absence')
    assert.equal(draft.recurrence?.occurrences, 3)
    assert.equal(draft.partialDay?.startTime, '08:00')
  })

  it('blocks invalid submit states before the command layer', () => {
    assert.equal(
      canSubmitRequestDraft({
        bookingType: 'pair',
        clockIn: '',
        clockOut: '',
        fromDate: '2026-05-04',
        hasBlockingPolicyIssue: false,
        kind: 'booking',
        officialType: 'full-day',
        selectedAbsenceType: undefined,
        singleDate: '2026-05-04',
        toDate: '2026-05-04',
      }),
      false
    )
    assert.equal(
      canSubmitRequestDraft({
        bookingType: 'pair',
        clockIn: '08:00',
        clockOut: '',
        fromDate: '2026-05-04',
        hasBlockingPolicyIssue: false,
        kind: 'booking',
        officialType: 'full-day',
        selectedAbsenceType: undefined,
        singleDate: '2026-05-04',
        toDate: '2026-05-04',
      }),
      true
    )
  })

  it('derives approval and history rows by viewer scope', () => {
    const rows = buildRequestRows({
      attendanceTypes: [vacationType],
      requests: [
        request(),
        request({
          employeeId: 'employee-2',
          employeeName: 'Sven Sales',
          id: 'request-sales',
        }),
        request({
          id: 'request-approved',
          status: 'approved',
        }),
      ],
      users: employees,
      viewer,
    })
    const employeeById = new Map(
      employees.map((employee) => [employee.id, employee])
    )
    const approvalRows = getApprovalRows({ employeeById, rows, viewer })
    const historyRows = getHistoryRows({ employeeById, rows, viewer })

    assert.deepEqual(
      approvalRows.map((row) => row.id),
      ['request-1']
    )
    assert.deepEqual(getApprovalEmployees(approvalRows), [
      { id: 'employee-1', name: 'Hannah Fischer' },
    ])
    assert.deepEqual(
      filterApprovalRows({
        employeeFilter: 'employee-1',
        kindFilter: 'absence',
        rows: approvalRows,
      }).map((row) => row.id),
      ['request-1']
    )
    assert.deepEqual(
      historyRows.map((row) => row.id),
      ['request-approved']
    )
  })

  it('searches request history by localized status and kind', () => {
    const rows = buildRequestRows({
      attendanceTypes: [vacationType],
      requests: [request({ id: 'request-approved', status: 'approved' })],
      users: employees,
      viewer,
    })

    // Minimal German translator for the status/kind keys used by the search.
    const de: Record<string, string> = {
      'requests.status.approved': 'Genehmigt',
      'requests.kind.absence': 'Abwesenheit',
    }
    const t = (key: string) => de[key] ?? key

    // Empty search returns everything.
    assert.equal(filterHistoryRows({ rows, search: '  ', t }).length, 1)

    // Localized status term matches even though the row was built in English.
    assert.equal(filterHistoryRows({ rows, search: 'genehmigt', t }).length, 1)
    // Localized kind term matches too.
    assert.equal(
      filterHistoryRows({ rows, search: 'abwesenheit', t }).length,
      1
    )
    // The raw status value stays matchable regardless of locale.
    assert.equal(filterHistoryRows({ rows, search: 'approved', t }).length, 1)
    // Non-matching term filters the row out.
    assert.equal(filterHistoryRows({ rows, search: 'rejected', t }).length, 0)
  })
})

describe('optimistic decision projection', () => {
  const submitted = [
    request({ id: 'a' }),
    request({ id: 'b' }),
    request({ id: 'c' }),
  ]

  it('marks only the decided requests as approved', () => {
    const next = applyDecisionToRequests(submitted, ['a', 'c'], 'approve')

    assert.deepEqual(
      next.map((item) => item.status),
      ['approved', 'submitted', 'approved']
    )
  })

  it('marks the decided requests as rejected', () => {
    const next = applyDecisionToRequests(submitted, ['b'], 'reject')

    assert.deepEqual(
      next.map((item) => item.status),
      ['submitted', 'rejected', 'submitted']
    )
  })

  it('leaves every other field untouched', () => {
    const [next] = applyDecisionToRequests(submitted, ['a'], 'approve')

    // Approval flow, audit trail, and timestamps are the server's to compute;
    // the projection must not invent them.
    assert.equal(next.updatedAt, submitted[0].updatedAt)
    assert.equal(next.approvalFlow, submitted[0].approvalFlow)
    assert.equal(next.employeeName, submitted[0].employeeName)
  })

  it('does not mutate the input list', () => {
    applyDecisionToRequests(submitted, ['a'], 'approve')

    assert.equal(submitted[0].status, 'submitted')
  })

  it('is a no-op when no id matches', () => {
    const next = applyDecisionToRequests(submitted, ['missing'], 'approve')

    assert.deepEqual(
      next.map((item) => item.status),
      ['submitted', 'submitted', 'submitted']
    )
  })
})

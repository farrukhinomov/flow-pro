import { putSeedAuditEvents } from '@/data/local/audit.repo'
import { getAllFromStore, putManyInStore } from '@/data/local/db'
import {
  DEFAULT_EMPLOYEE_ID,
  DEFAULT_EMPLOYEE_NAME,
} from '@/domain/attendance/types'
import type { AuditEvent, EmployeeRequest } from '@/domain/requests/types'
import { tStatic } from '@/i18n/static'

/**
 * Demo requests and the audit events that accompany them.
 *
 * Moved out of the requests repository, which used to seed these from inside an
 * ordinary read. The audit events are hash-sealed with the same chain used for
 * real evidence, so an accidental run against a real tenant put sealed fiction
 * on the compliance screen. Keeping them here means a production read path has
 * no way to reach them at all.
 */

const MANAGER_ID = 'usr-tobias-weber'
const MANAGER_NAME = 'Tobias Weber'

function makeSeedRequest(
  request: Omit<EmployeeRequest, 'syncState'>
): EmployeeRequest {
  return {
    ...request,
    syncState: 'synced',
  }
}

function makeSeedAuditEvent(
  request: EmployeeRequest,
  action: AuditEvent['action'],
  actorId: string,
  actorName: string,
  summary: string
): AuditEvent {
  return {
    id: `audit-${request.id}-${action}`,
    aggregate: 'request',
    aggregateId: request.id,
    action,
    actorId,
    actorName,
    classification: 'personal-data',
    createdAt: request.updatedAt,
    summary,
  }
}

function getSeedRequests() {
  const ownHomeOffice = makeSeedRequest({
    id: 'request-seed-ho-2026-05-27',
    kind: 'absence',
    employeeId: DEFAULT_EMPLOYEE_ID,
    employeeName: DEFAULT_EMPLOYEE_NAME,
    fromDate: '2026-05-27',
    toDate: '2026-05-27',
    statusTypeId: 'ho',
    statusCode: 'HO',
    statusLabel: tStatic('common.homeOffice'),
    subtype: tStatic('common.homeOffice'),
    reason: tStatic('requestsUi.seedReasons.focusDay'),
    status: 'submitted',
    submittedAt: '2026-05-20T08:00:00.000Z',
    updatedAt: '2026-05-20T08:00:00.000Z',
  })
  const ownVacation = makeSeedRequest({
    id: 'request-seed-vac-2026-06-15',
    kind: 'absence',
    employeeId: DEFAULT_EMPLOYEE_ID,
    employeeName: DEFAULT_EMPLOYEE_NAME,
    fromDate: '2026-06-15',
    toDate: '2026-06-19',
    statusTypeId: 'vac',
    statusCode: 'VAC',
    statusLabel: tStatic('requestsUi.seedLabels.vacation'),
    subtype: tStatic('requestsUi.seedLabels.vacation'),
    reason: tStatic('requestsUi.seedReasons.summerVacation'),
    status: 'approved',
    submittedAt: '2026-05-10T09:20:00.000Z',
    updatedAt: '2026-05-11T13:30:00.000Z',
    decision: {
      decision: 'approve',
      decidedAt: '2026-05-11T13:30:00.000Z',
      decidedById: MANAGER_ID,
      decidedByName: MANAGER_NAME,
    },
  })
  const ownRejected = makeSeedRequest({
    id: 'request-seed-off-2026-02-27',
    kind: 'absence',
    employeeId: DEFAULT_EMPLOYEE_ID,
    employeeName: DEFAULT_EMPLOYEE_NAME,
    fromDate: '2026-02-27',
    toDate: '2026-02-27',
    statusTypeId: 'off',
    statusCode: 'OFF',
    statusLabel: tStatic('attendanceUi.defaultTypeUnavailable'),
    subtype: tStatic('attendanceUi.defaultTypeUnavailable'),
    reason: tStatic('requestsUi.seedReasons.privateAppointment'),
    status: 'rejected',
    submittedAt: '2026-02-20T10:15:00.000Z',
    updatedAt: '2026-02-21T12:00:00.000Z',
    decision: {
      decision: 'reject',
      decidedAt: '2026-02-21T12:00:00.000Z',
      decidedById: MANAGER_ID,
      decidedByName: MANAGER_NAME,
      comment: 'Coverage is too low on this date.',
    },
  })
  const teammateVacation = makeSeedRequest({
    id: 'request-seed-team-vac-2026-06-03',
    kind: 'absence',
    employeeId: 'usr-hannah-fischer',
    employeeName: 'Hannah Fischer',
    fromDate: '2026-06-03',
    toDate: '2026-06-05',
    statusTypeId: 'vac',
    statusCode: 'VAC',
    statusLabel: tStatic('requestsUi.seedLabels.vacation'),
    subtype: tStatic('requestsUi.seedLabels.vacation'),
    reason: tStatic('requestsUi.seedReasons.familyTravel'),
    status: 'submitted',
    submittedAt: '2026-05-21T07:45:00.000Z',
    updatedAt: '2026-05-21T07:45:00.000Z',
  })
  const teammateBooking = makeSeedRequest({
    id: 'request-seed-team-booking-2026-05-22',
    kind: 'booking-correction',
    employeeId: 'usr-jonas-wagner',
    employeeName: 'Jonas Wagner',
    fromDate: '2026-05-22',
    toDate: '2026-05-22',
    subtype: tStatic('requestsUi.seedLabels.addBookingPair'),
    clockIn: '08:30',
    clockOut: '17:00',
    reason: tStatic('requestsUi.seedReasons.forgotTerminalClockIn'),
    status: 'submitted',
    submittedAt: '2026-05-22T16:15:00.000Z',
    updatedAt: '2026-05-22T16:15:00.000Z',
  })

  return [
    ownHomeOffice,
    ownVacation,
    ownRejected,
    teammateVacation,
    teammateBooking,
  ]
}

export async function installDemoRequests() {
  const current = await getAllFromStore<EmployeeRequest>('employeeRequests')

  if (current.length > 0) return

  const requests = getSeedRequests()
  const auditEvents = requests.flatMap((request) => {
    const submitted = makeSeedAuditEvent(
      request,
      'request.submitted',
      request.employeeId,
      request.employeeName,
      tStatic('requestsUi.auditSummaries.submitted', {
        employeeName: request.employeeName,
        subtype: request.subtype,
      })
    )

    if (request.status === 'approved' || request.status === 'rejected') {
      return [
        submitted,
        makeSeedAuditEvent(
          request,
          request.status === 'approved'
            ? 'request.approved'
            : 'request.rejected',
          request.decision?.decidedById ?? MANAGER_ID,
          request.decision?.decidedByName ?? MANAGER_NAME,
          tStatic('requestsUi.auditSummaries.decided', {
            actorName: request.decision?.decidedByName ?? MANAGER_NAME,
            status: tStatic(`requests.status.${request.status}`),
            subtype: request.subtype,
          })
        ),
      ]
    }

    return [submitted]
  })

  await putManyInStore('employeeRequests', requests)
  await putSeedAuditEvents(auditEvents)
}

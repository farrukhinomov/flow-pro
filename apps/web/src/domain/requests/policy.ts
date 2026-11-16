import { tStatic } from '@/i18n/static'
import type { EmployeeRequest, RequestSubmissionDraft } from './types'

export type RequestPolicyIssue = {
  code: string
  message: string
  severity: 'blocking' | 'warning'
}

export type RequestPolicyEvaluation = {
  blocking: RequestPolicyIssue[]
  warnings: RequestPolicyIssue[]
}

const ACTIVE_REQUEST_STATUSES = new Set(['submitted', 'approved'])

function parseIsoDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + days)
  return nextDate
}

function addWeeksIsoDate(date: string, weeks: number) {
  const nextDate = parseIsoDate(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + weeks * 7)

  return toIsoDate(nextDate)
}

function eachDateInRange(fromDate: string, toDate: string) {
  if (!fromDate || !toDate || toDate < fromDate) return []

  const dates: string[] = []
  for (
    let cursor = parseIsoDate(fromDate);
    cursor <= parseIsoDate(toDate);
    cursor = addDays(cursor, 1)
  ) {
    dates.push(toIsoDate(cursor))
  }

  return dates
}

function isBusinessDate(date: string) {
  const day = parseIsoDate(date).getUTCDay()
  return day !== 0 && day !== 6
}

function countBusinessDates(fromDate: string, toDate: string) {
  return eachDateInRange(fromDate, toDate).filter(isBusinessDate).length
}

function getDraftOccurrences(draft: RequestSubmissionDraft) {
  const recurrence = draft.recurrence
  const occurrences =
    recurrence?.frequency === 'weekly' ? recurrence.occurrences : 1

  return Array.from({ length: occurrences }, (_, index) => ({
    fromDate: addWeeksIsoDate(draft.fromDate, index),
    toDate: addWeeksIsoDate(draft.toDate, index),
  }))
}

function rangesOverlap(
  firstFrom: string,
  firstTo: string,
  secondFrom: string,
  secondTo: string
) {
  return firstFrom <= secondTo && secondFrom <= firstTo
}

function isActiveRequest(request: EmployeeRequest) {
  return ACTIVE_REQUEST_STATUSES.has(request.status)
}

function requestMonthKey(date: string) {
  return date.slice(0, 7)
}

function countHomeOfficeBusinessDaysInMonth({
  employeeId,
  monthKey,
  requests,
}: {
  employeeId: string
  monthKey: string
  requests: EmployeeRequest[]
}) {
  return requests
    .filter(
      (request) =>
        isActiveRequest(request) &&
        request.employeeId === employeeId &&
        request.statusCode === 'HO'
    )
    .flatMap((request) => eachDateInRange(request.fromDate, request.toDate))
    .filter(
      (date) => requestMonthKey(date) === monthKey && isBusinessDate(date)
    ).length
}

export function evaluateRequestDraftPolicy({
  draft,
  existingRequests,
  maxHomeOfficeDaysPerMonth = 8,
  teamConflictThreshold = 2,
  vacationAvailableDays = 10,
}: {
  draft: RequestSubmissionDraft
  existingRequests: EmployeeRequest[]
  maxHomeOfficeDaysPerMonth?: number
  teamConflictThreshold?: number
  vacationAvailableDays?: number
}): RequestPolicyEvaluation {
  const blocking: RequestPolicyIssue[] = []
  const warnings: RequestPolicyIssue[] = []
  const occurrences = getDraftOccurrences(draft)

  if (draft.toDate < draft.fromDate) {
    blocking.push({
      code: 'invalid-date-range',
      message: tStatic('requestsUi.validation.endDateBeforeStart'),
      severity: 'blocking',
    })
  }

  if (
    draft.partialDay?.mode === 'custom' &&
    (!draft.partialDay.startTime ||
      !draft.partialDay.endTime ||
      draft.partialDay.endTime <= draft.partialDay.startTime)
  ) {
    blocking.push({
      code: 'invalid-partial-day',
      message: tStatic('requestsUi.validation.validPartialDayRange'),
      severity: 'blocking',
    })
  }

  const ownConflicts = existingRequests.filter(
    (request) =>
      isActiveRequest(request) &&
      request.employeeId === draft.employeeId &&
      occurrences.some((occurrence) =>
        rangesOverlap(
          occurrence.fromDate,
          occurrence.toDate,
          request.fromDate,
          request.toDate
        )
      )
  )

  if (ownConflicts.length > 0) {
    warnings.push({
      code: 'own-request-conflict',
      message: tStatic('requestsUi.policyWarnings.ownRequestConflict'),
      severity: 'warning',
    })
  }

  const requestedVacationDays =
    draft.statusCode === 'VAC'
      ? occurrences.reduce(
          (total, occurrence) =>
            total + countBusinessDates(occurrence.fromDate, occurrence.toDate),
          0
        )
      : 0

  if (requestedVacationDays > vacationAvailableDays) {
    blocking.push({
      code: 'vacation-balance',
      message: tStatic('requestsUi.policyWarnings.vacationBalance', {
        requestedVacationDays,
        vacationAvailableDays,
      }),
      severity: 'blocking',
    })
  }

  if (draft.statusCode === 'HO') {
    const requestedHomeOfficeDaysByMonth = new Map<string, number>()
    occurrences
      .flatMap((occurrence) =>
        eachDateInRange(occurrence.fromDate, occurrence.toDate)
      )
      .filter(isBusinessDate)
      .forEach((date) => {
        const monthKey = requestMonthKey(date)
        requestedHomeOfficeDaysByMonth.set(
          monthKey,
          (requestedHomeOfficeDaysByMonth.get(monthKey) ?? 0) + 1
        )
      })

    for (const [monthKey, requestedDays] of requestedHomeOfficeDaysByMonth) {
      const alreadyPlannedDays = countHomeOfficeBusinessDaysInMonth({
        employeeId: draft.employeeId,
        monthKey,
        requests: existingRequests,
      })

      if (alreadyPlannedDays + requestedDays > maxHomeOfficeDaysPerMonth) {
        warnings.push({
          code: 'home-office-limit',
          message: tStatic('requestsUi.policyWarnings.homeOfficeLimit', {
            currentDays: alreadyPlannedDays + requestedDays,
            monthKey,
            maxDays: maxHomeOfficeDaysPerMonth,
          }),
          severity: 'warning',
        })
      }
    }
  }

  const coverageRisk = occurrences.some((occurrence) => {
    const overlappingTeamRequests = existingRequests.filter(
      (request) =>
        isActiveRequest(request) &&
        request.employeeId !== draft.employeeId &&
        request.kind === 'absence' &&
        rangesOverlap(
          occurrence.fromDate,
          occurrence.toDate,
          request.fromDate,
          request.toDate
        )
    )

    return overlappingTeamRequests.length >= teamConflictThreshold
  })

  if (coverageRisk) {
    warnings.push({
      code: 'team-coverage',
      message: tStatic('requestsUi.policyWarnings.teamCoverage'),
      severity: 'warning',
    })
  }

  return { blocking, warnings }
}

import { buildDefaultWorkContract } from '@/domain/attendance/policy-engine'
import type {
  AppliedTimeCorrection,
  AttendancePolicyConfig,
  ClockEvent,
  WorkContract,
} from '@/domain/attendance/types'
import type { EmployeeRequest } from '@/domain/requests/types'
import { defaultWorkContract } from '@/domain/timesheet/policies'
import type { EmployeeUser } from '@/domain/users/types'
import type { Locale } from '@/i18n'
import {
  applyApprovedAbsencesToRows,
  createMonthRows,
  mergeRowsWithClockEvents,
} from './timesheet-view-model'
import type { DayRow } from './types'

export function resolveTimesheetWorkContract({
  employee,
  employeeId,
  policyConfig,
}: {
  employee?: EmployeeUser
  employeeId: string
  policyConfig: AttendancePolicyConfig | null
}): WorkContract {
  if (employee && policyConfig) {
    return buildDefaultWorkContract({
      config: policyConfig,
      employee,
    })
  }

  return {
    ...defaultWorkContract,
    employeeId,
  }
}

export function buildEmployeeTimesheetRows({
  corrections,
  employeeId,
  events,
  locale,
  periodMonth,
  regionCode,
  requests,
  timeZone,
  workContract,
}: {
  corrections: AppliedTimeCorrection[]
  employeeId: string
  events: ClockEvent[]
  locale: Locale
  periodMonth: string
  /** Federal state whose holiday calendar applies; falls back to the nationwide set. */
  regionCode?: string
  requests: EmployeeRequest[]
  /** Workspace zone anchoring day assignment; browser zone when unknown. */
  timeZone?: string
  workContract: WorkContract
}): DayRow[] {
  return mergeRowsWithClockEvents({
    baseRows: applyApprovedAbsencesToRows({
      baseRows: createMonthRows(periodMonth, workContract, locale, regionCode),
      employeeId,
      periodMonth,
      requests,
    }),
    corrections,
    events,
    periodMonth,
    timeZone,
  })
}

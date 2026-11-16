import { getAttendancePolicyConfigBackendFirst } from '@/data/attendance-policy.gateway'
import { listAllClockEvents } from '@/data/local/attendance.repo'
import { cacheReportsPackage } from '@/data/local/reports-packages.repo'
import { listEmployeeRequests } from '@/data/local/requests.repo'
import { listAllTimesheetApprovals } from '@/data/local/timesheet.repo'
import { listEmployeeUsersBackendFirst } from '@/data/users.gateway'
import {
  buildReportsPackage,
  type ReportsPackage,
} from '@/domain/reports/payroll'
import {
  getReportsPackageWorkflow,
  shouldFallbackToLocalReports,
} from './api/reports.api'

export async function getReportsPackageBackendFirst(
  periodMonth: string
): Promise<ReportsPackage> {
  try {
    const reportsPackage = await getReportsPackageWorkflow(periodMonth)
    await cacheReportsPackage(reportsPackage)
    return reportsPackage
  } catch (error) {
    if (!shouldFallbackToLocalReports(error)) {
      throw error
    }

    const [users, requests, clockEvents, policy, approvals] = await Promise.all(
      [
        listEmployeeUsersBackendFirst(),
        listEmployeeRequests(),
        listAllClockEvents(),
        getAttendancePolicyConfigBackendFirst(),
        listAllTimesheetApprovals(),
      ]
    )

    return buildReportsPackage({
      approvals,
      clockEvents,
      periodMonth,
      policy,
      requests,
      users,
    })
  }
}

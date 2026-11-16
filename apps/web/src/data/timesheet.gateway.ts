import type { MonthlyTimesheetApproval } from '@/domain/attendance/types'
import {
  getTimesheetApprovalWorkflow,
  shouldFallbackToLocalTimesheet,
} from './api/timesheet.api'
import {
  cacheTimesheetApproval,
  getTimesheetApproval,
} from './local/timesheet.repo'

export async function getTimesheetApprovalBackendFirst(
  employeeId: string,
  periodMonth: string
): Promise<MonthlyTimesheetApproval> {
  try {
    const approval = await getTimesheetApprovalWorkflow({
      employeeId,
      periodMonth,
    })
    await cacheTimesheetApproval(approval)
    return approval
  } catch (error) {
    if (!shouldFallbackToLocalTimesheet(error)) throw error
  }

  return getTimesheetApproval(employeeId, periodMonth)
}

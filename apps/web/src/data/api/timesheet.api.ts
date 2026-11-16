import type { MonthlyTimesheetApproval } from '@/domain/attendance/types'
import type { PayrollExport } from '@/domain/timesheet/exports'
import { FlowProApiError, flowProApi } from './http-client'

type ApiMonthlyTimesheetApproval = {
  id: string
  employeeId: string
  periodMonth: string
  status: MonthlyTimesheetApproval['status']
  signedById?: string | null
  signedByName?: string | null
  signedAt?: string | null
  note?: string | null
  payrollExportedAt?: string | null
  pdfExportedAt?: string | null
  updatedAt: string
}

export type SignTimesheetWorkflowInput = {
  employeeId: string
  note?: string
  periodMonth: string
  signedById?: string
  signedByName?: string
  snapshot?: Pick<PayrollExport, 'rows' | 'totals'>
}

export async function getTimesheetApprovalWorkflow({
  employeeId,
  periodMonth,
}: {
  employeeId: string
  periodMonth: string
}) {
  const response = await flowProApi.get<ApiMonthlyTimesheetApproval>(
    `/timesheet-workflows/${encodeURIComponent(employeeId)}/${encodeURIComponent(periodMonth)}`
  )

  return mapApprovalFromApi(response.data)
}

export async function signTimesheetApprovalWorkflow({
  employeeId,
  note,
  periodMonth,
  snapshot,
}: SignTimesheetWorkflowInput) {
  const response = await flowProApi.post<ApiMonthlyTimesheetApproval>(
    `/timesheet-workflows/${encodeURIComponent(employeeId)}/${encodeURIComponent(periodMonth)}/sign`,
    {
      note,
      snapshot: snapshot
        ? {
            rows: snapshot.rows,
            totals: snapshot.totals,
          }
        : undefined,
    }
  )

  return mapApprovalFromApi(response.data)
}

export async function markTimesheetExportedWorkflow({
  employeeId,
  kind,
  periodMonth,
}: {
  employeeId: string
  kind: 'payroll' | 'pdf'
  periodMonth: string
}) {
  const response = await flowProApi.post<ApiMonthlyTimesheetApproval>(
    `/timesheet-workflows/${encodeURIComponent(employeeId)}/${encodeURIComponent(periodMonth)}/exports/${kind}`
  )

  return mapApprovalFromApi(response.data)
}

export function shouldFallbackToLocalTimesheet(error: unknown) {
  return (
    !(error instanceof FlowProApiError) ||
    error.status === undefined ||
    error.status >= 500
  )
}

function mapApprovalFromApi(
  approval: ApiMonthlyTimesheetApproval
): MonthlyTimesheetApproval {
  return {
    id: approval.id,
    employeeId: approval.employeeId,
    note: approval.note ?? undefined,
    payrollExportedAt: approval.payrollExportedAt ?? undefined,
    pdfExportedAt: approval.pdfExportedAt ?? undefined,
    periodMonth: approval.periodMonth,
    signedAt: approval.signedAt ?? undefined,
    signedById: approval.signedById ?? undefined,
    signedByName: approval.signedByName ?? undefined,
    status: approval.status,
    updatedAt: approval.updatedAt,
  }
}

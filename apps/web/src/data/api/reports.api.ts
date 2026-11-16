import type { ReportsPackage } from '@/domain/reports/payroll'
import type { EmployeeUser } from '@/domain/users/types'
import { FlowProApiError, flowProApi } from './http-client'

type ApiEmployeeUser = Omit<
  EmployeeUser,
  | 'createdAt'
  | 'deactivatedAt'
  | 'lastSeenAt'
  | 'nextReviewAt'
  | 'retentionUntil'
  | 'updatedAt'
> & {
  createdAt: string
  deactivatedAt?: string | null
  lastSeenAt?: string | null
  nextReviewAt?: string | null
  retentionUntil?: string | null
  updatedAt: string
}

type ApiReportsPackage = Omit<ReportsPackage, 'employeeReports'> & {
  employeeReports: Array<
    Omit<ReportsPackage['employeeReports'][number], 'employee'> & {
      employee: ApiEmployeeUser
    }
  >
}

export async function getReportsPackageWorkflow(periodMonth: string) {
  const response = await flowProApi.get<ApiReportsPackage>(
    `/report-workflows/${encodeURIComponent(periodMonth)}`
  )

  return mapReportsPackage(response.data)
}

export function shouldFallbackToLocalReports(error: unknown) {
  return (
    !(error instanceof FlowProApiError) ||
    error.status === undefined ||
    error.status >= 500
  )
}

function mapReportsPackage(report: ApiReportsPackage): ReportsPackage {
  return {
    ...report,
    employeeReports: report.employeeReports.map((employeeReport) => ({
      ...employeeReport,
      employee: mapEmployee(employeeReport.employee),
    })),
  }
}

function mapEmployee(employee: ApiEmployeeUser): EmployeeUser {
  return {
    ...employee,
    createdAt: new Date(employee.createdAt),
    deactivatedAt: employee.deactivatedAt
      ? new Date(employee.deactivatedAt)
      : undefined,
    lastSeenAt: employee.lastSeenAt ? new Date(employee.lastSeenAt) : undefined,
    nextReviewAt: employee.nextReviewAt
      ? new Date(employee.nextReviewAt)
      : undefined,
    retentionUntil: employee.retentionUntil
      ? new Date(employee.retentionUntil)
      : undefined,
    updatedAt: new Date(employee.updatedAt),
  }
}

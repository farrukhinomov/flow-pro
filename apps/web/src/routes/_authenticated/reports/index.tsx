import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { applicationStore } from '@/application/application-store'
import { timesheetWorkflow } from '@/application/timesheet-workflow'
import {
  createPayrollExportArtifact,
  downloadPayrollExportArtifact,
  type PayrollExportArtifactKind,
} from '@/data/api/payroll-export-artifacts.api'
import { getAttendancePolicyConfigBackendFirst } from '@/data/attendance-policy.gateway'
import {
  canViewFullAudit,
  canViewTeamPlanning,
  getTimesheetVisibleEmployees,
} from '@/domain/access/access-control'
import { getDefaultAttendancePolicyConfig } from '@/domain/attendance/policies'
import {
  DEFAULT_EMPLOYEE_ID,
  DEFAULT_EMPLOYEE_NAME,
  type AttendancePolicyConfig,
  type MonthlyTimesheetApproval,
} from '@/domain/attendance/types'
import {
  buildAbsenceBalanceCsv,
  buildPayrollReportCsv,
  buildReportsExcelHtml,
  buildReportsPdfHtml,
  buildTeamReportCsv,
  type ReportsPackage,
} from '@/domain/reports/payroll'
import type { EmployeeUser } from '@/domain/users/types'
import { useI18n } from '@/i18n'
import { ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import {
  downloadBlobFile,
  downloadCsvFile,
  downloadTextFile,
} from '@/lib/download'
import { resolvePeriodWindowBounds } from '@/lib/period-window'
import {
  formatPeriodMonth,
  getCurrentMonthDate,
  parsePeriodMonth,
} from '@/lib/periods'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MonthYearPicker } from '@/components/flowpro/month-year-picker'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { useCurrentViewer } from '@/features/access/use-current-viewer'
import { RouteError } from '@/features/errors/route-error'
import {
  PayrollPackageCard,
  ReportsSummaryCards,
  ReportsTabs,
} from '@/features/reports/components'

export const Route = createFileRoute('/_authenticated/reports/')({
  component: ReportsPage,
  errorComponent: RouteError,
})

function ReportsPage() {
  const { locale, t } = useI18n()
  const viewer = useCurrentViewer()
  const [periodMonth, setPeriodMonth] = useState(() =>
    formatPeriodMonth(getCurrentMonthDate())
  )
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all')
  const [users, setUsers] = useState<EmployeeUser[]>([])
  const [policyConfig, setPolicyConfig] =
    useState<AttendancePolicyConfig | null>(null)
  const [report, setReport] = useState<ReportsPackage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const periodDate = useMemo(() => parsePeriodMonth(periodMonth), [periodMonth])
  const reportWindow = useMemo(
    () =>
      resolvePeriodWindowBounds(
        getCurrentMonthDate(),
        policyConfig?.periodWindows.reports ??
          getDefaultAttendancePolicyConfig().periodWindows.reports
      ),
    [policyConfig]
  )

  const canViewReports = canViewTeamPlanning(viewer) || canViewFullAudit(viewer)
  const visibleUsers = useMemo(
    () => getTimesheetVisibleEmployees({ employees: users, viewer }),
    [users, viewer]
  )
  const scopedSelectedEmployeeId =
    selectedEmployeeId === 'all' ||
    visibleUsers.some((user) => user.id === selectedEmployeeId)
      ? selectedEmployeeId
      : 'all'

  const refresh = useCallback(async () => {
    const [nextReport, policy] = await Promise.all([
      applicationStore.getReportsPackage({
        onSnapshot: ({ data }) => {
          setReport(data)
          setUsers(
            data.employeeReports.map(
              (employeeReport) => employeeReport.employee
            )
          )
        },
        periodMonth,
      }),
      getAttendancePolicyConfigBackendFirst(),
    ])

    setReport(nextReport)
    setPolicyConfig(policy)
    setUsers(
      nextReport.employeeReports.map(
        (employeeReport) => employeeReport.employee
      )
    )
    setIsLoading(false)
  }, [periodMonth])

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => {
      void refresh()
    }, 0)

    return () => window.clearTimeout(initialRefresh)
  }, [refresh])

  const visibleEmployeeReports = useMemo(() => {
    const reports = report?.employeeReports ?? []
    const visibleUserIds = new Set(visibleUsers.map((user) => user.id))
    const scopedReports = reports.filter((employeeReport) =>
      visibleUserIds.has(employeeReport.employee.id)
    )

    if (scopedSelectedEmployeeId === 'all') return scopedReports

    return scopedReports.filter(
      (employeeReport) =>
        employeeReport.employee.id === scopedSelectedEmployeeId
    )
  }, [report, scopedSelectedEmployeeId, visibleUsers])
  const visibleReport = useMemo(() => {
    if (!report || scopedSelectedEmployeeId === 'all') return report

    return {
      ...report,
      absenceBalances: report.absenceBalances.filter(
        (balance) => balance.employeeId === scopedSelectedEmployeeId
      ),
      employeeReports: visibleEmployeeReports,
    }
  }, [report, scopedSelectedEmployeeId, visibleEmployeeReports])
  const summary = useMemo(
    () =>
      visibleEmployeeReports.reduce(
        (sum, employeeReport) => ({
          complianceIssues:
            sum.complianceIssues + employeeReport.totals.complianceIssues,
          flexHours: sum.flexHours + employeeReport.totals.flexHours,
          locked:
            sum.locked + (employeeReport.approval?.status === 'signed' ? 1 : 0),
          open:
            sum.open + (employeeReport.approval?.status === 'signed' ? 0 : 1),
          paidHours: sum.paidHours + employeeReport.totals.paidHours,
          targetHours: sum.targetHours + employeeReport.totals.targetHours,
          workedHours: sum.workedHours + employeeReport.totals.workedHours,
        }),
        {
          complianceIssues: 0,
          flexHours: 0,
          locked: 0,
          open: 0,
          paidHours: 0,
          targetHours: 0,
          workedHours: 0,
        }
      ),
    [visibleEmployeeReports]
  )

  const exportLocalReport = useCallback(
    (kind: PayrollExportArtifactKind, nextReport: ReportsPackage) => {
      if (kind === 'payroll') {
        downloadCsvFile(
          `flowpro-payroll-${periodMonth}.csv`,
          buildPayrollReportCsv(nextReport)
        )
      }

      if (kind === 'balances') {
        downloadCsvFile(
          `flowpro-absence-balances-${periodMonth}.csv`,
          buildAbsenceBalanceCsv(nextReport)
        )
      }

      if (kind === 'teams') {
        downloadCsvFile(
          `flowpro-team-report-${periodMonth}.csv`,
          buildTeamReportCsv(nextReport)
        )
      }

      if (kind === 'excel') {
        downloadTextFile(
          `flowpro-reports-${periodMonth}.xls`,
          buildReportsExcelHtml(nextReport, locale),
          'application/vnd.ms-excel;charset=utf-8'
        )
      }

      if (kind === 'pdf') {
        const html = buildReportsPdfHtml(nextReport, locale)
        const printWindow = window.open('', '_blank')

        if (printWindow) {
          printWindow.document.write(html)
          printWindow.document.close()
          printWindow.focus()
          printWindow.print()
        } else {
          downloadTextFile(
            `flowpro-reports-${periodMonth}.html`,
            html,
            'text/html;charset=utf-8'
          )
          toast.info(t('timesheetPage.printBlocked'))
        }
      }
    },
    [locale, periodMonth, t]
  )

  const exportReport = useCallback(
    async (kind: PayrollExportArtifactKind) => {
      if (!visibleReport) return

      try {
        const artifact = await createPayrollExportArtifact({
          employeeId:
            scopedSelectedEmployeeId === 'all'
              ? undefined
              : scopedSelectedEmployeeId,
          kind,
          locale,
          periodMonth,
        })
        const blob = await downloadPayrollExportArtifact(artifact.id)

        downloadBlobFile(artifact.fileName, blob)
      } catch {
        exportLocalReport(kind, visibleReport)
      }

      const exportedApprovals = visibleEmployeeReports
        .map((employeeReport) => employeeReport.approval)
        .filter(
          (approval): approval is MonthlyTimesheetApproval =>
            !!approval && approval.status === 'signed'
        )

      if (kind === 'payroll' || kind === 'pdf') {
        await Promise.all(
          exportedApprovals.map((approval) =>
            timesheetWorkflow.markExported({
              approval,
              kind: kind === 'pdf' ? 'pdf' : 'payroll',
            })
          )
        )

        await refresh()
      }

      toast.success(t('reportsUi.reportExportGenerated'))
    },
    [
      exportLocalReport,
      periodMonth,
      refresh,
      scopedSelectedEmployeeId,
      visibleEmployeeReports,
      visibleReport,
      locale,
      t,
    ]
  )

  const signVisiblePeriods = useCallback(async () => {
    const openReports = visibleEmployeeReports.filter(
      (employeeReport) => employeeReport.approval?.status !== 'signed'
    )

    if (openReports.length === 0) {
      toast.info(t('reportsUi.allVisiblePeriodsAlreadySigned'))
      return
    }

    await Promise.all(
      openReports.map((employeeReport) =>
        timesheetWorkflow.signMonthlyTimesheet({
          employeeId: employeeReport.employee.id,
          note: t('reportsUi.signedFromReportsPayroll'),
          periodMonth,
          signedById: viewer.employeeId ?? DEFAULT_EMPLOYEE_ID,
          signedByName: viewer.name ?? DEFAULT_EMPLOYEE_NAME,
        })
      )
    )

    await refresh()
    toast.success(t('reportsUi.visibleMonthlyPeriodsSignedLocked'))
  }, [
    periodMonth,
    refresh,
    viewer.employeeId,
    viewer.name,
    visibleEmployeeReports,
    t,
  ])

  return (
    <>
      <Header>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='max-w-full min-w-0 space-y-6 overflow-x-hidden'>
        <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
          <div>
            {/*
              These describe what the page covers; they are not controls. As outline badges
              they were indistinguishable from the tab strip further down, and one of them
              repeated a real tab label, so they read as navigation that did not respond.
            */}
            <p className='mb-2 text-xs tracking-wide text-muted-foreground uppercase'>
              {[
                t('reportsUi.payroll'),
                t('reportsUi.monthlySignOff'),
                t('reportsUi.compliance'),
              ].join(' · ')}
            </p>
            <h2 className='text-2xl font-bold tracking-tight'>
              {t('reportsUi.reportsPayroll')}
            </h2>
            <p className='text-muted-foreground'>
              {t('reportsUi.reportsPayrollDescription')}
            </p>
          </div>
          <div className='grid w-full gap-2 sm:w-auto sm:grid-cols-[minmax(17rem,auto)_14rem]'>
            <MonthYearPicker
              max={reportWindow.max}
              min={reportWindow.min}
              value={periodDate}
              onChange={(nextDate) =>
                setPeriodMonth(formatPeriodMonth(nextDate))
              }
              className='w-full sm:min-w-[17rem]'
            />
            <Select
              value={scopedSelectedEmployeeId}
              onValueChange={setSelectedEmployeeId}
            >
              <SelectTrigger
                className='w-full'
                aria-label={t('requestsUi.employee')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>
                  {t('requestsUi.allEmployees')}
                </SelectItem>
                {visibleUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!canViewReports ? (
          <Alert>
            <ShieldAlert className='h-4 w-4' />
            <AlertTitle>{t('reportsUi.accessRestricted')}</AlertTitle>
            <AlertDescription>
              {t('reportsUi.accessRestrictedDescription')}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <ReportsSummaryCards isLoading={isLoading} summary={summary} />

            <PayrollPackageCard
              isLoading={isLoading}
              onExport={(kind) => void exportReport(kind)}
              onSignVisible={() => void signVisiblePeriods()}
              periodMonth={periodMonth}
            />

            <ReportsTabs
              employeeReports={visibleEmployeeReports}
              isLoading={isLoading}
              onExport={(kind) => void exportReport(kind)}
              report={visibleReport}
            />
          </>
        )}
      </Main>
    </>
  )
}

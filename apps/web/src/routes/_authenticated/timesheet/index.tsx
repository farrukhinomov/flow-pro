import { useEffect, useMemo, useState } from 'react'
import { addDays, addMonths, endOfMonth, format, startOfMonth } from 'date-fns'
import { createFileRoute } from '@tanstack/react-router'
import { applicationStore } from '@/application/application-store'
import { timesheetWorkflow } from '@/application/timesheet-workflow'
import { resolveApiErrorMessage } from '@/data/api/api-error'
import { loadMyClockEventsRange } from '@/data/api/attendance.gateway'
import { getAttendancePolicyConfigBackendFirst } from '@/data/attendance-policy.gateway'
import {
  listClockEventsForEmployee,
  listTimeCorrectionsForEmployee,
} from '@/data/local/attendance.repo'
import { listEmployeeRequests } from '@/data/local/requests.repo'
import {
  canSignEmployeeTimesheet,
  canViewFullAudit,
  getTimesheetVisibleEmployees,
} from '@/domain/access/access-control'
import { getDefaultAttendancePolicyConfig } from '@/domain/attendance/policies'
import {
  DEFAULT_EMPLOYEE_NAME,
  type AttendancePolicyConfig,
  type AppliedTimeCorrection,
  type ClockEvent,
  type MonthlyTimesheetApproval,
} from '@/domain/attendance/types'
import { weekStartOffset } from '@/domain/attendance/week'
import type { EmployeeRequest } from '@/domain/requests/types'
import {
  buildPayrollCsv,
  buildTimesheetPdfHtml,
} from '@/domain/timesheet/exports'
import type { EmployeeUser } from '@/domain/users/types'
import { useI18n } from '@/i18n'
import { toast } from 'sonner'
import { downloadCsvFile, downloadTextFile } from '@/lib/download'
import { resolvePeriodWindowBounds } from '@/lib/period-window'
import {
  formatPeriodMonth,
  getCurrentMonthDate,
  parsePeriodMonth,
} from '@/lib/periods'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { useCurrentViewer } from '@/features/access/use-current-viewer'
import { useWorkspaceTimeZone } from '@/features/attendance/use-workspace-time-zone'
import { RouteError } from '@/features/errors/route-error'
import { useUserPreferences } from '@/features/settings/use-user-preferences'
import {
  PeriodSummary,
  TimeCorrectionDrawer,
  TimesheetDayDetailsDrawer,
  TimesheetLedger,
  VacationBalance,
} from '@/features/timesheet/components'
import {
  TimesheetControls,
  TimesheetLedgerToolbar,
  TimesheetMetricsGrid,
  TimesheetPageHeader,
  TimesheetSignOffPanel,
} from '@/features/timesheet/page-components'
import { getPeriodParts } from '@/features/timesheet/timesheet-formatting'
import {
  buildEmployeeTimesheetRows,
  resolveTimesheetWorkContract,
} from '@/features/timesheet/timesheet-projection'
import {
  buildTimesheetPayrollExport,
  getTimesheetMetrics,
  isException,
  selectElapsedRows,
} from '@/features/timesheet/timesheet-view-model'
import type { DayRow } from '@/features/timesheet/types'

export const Route = createFileRoute('/_authenticated/timesheet/')({
  component: TimesheetPage,
  errorComponent: RouteError,
})

function TimesheetPage() {
  const { locale, t } = useI18n()
  const viewer = useCurrentViewer()
  const { preferences } = useUserPreferences()
  const preferredWeekStart = preferences.weekStart
  const workspaceTimeZone = useWorkspaceTimeZone()
  const [workspaceTab, setWorkspaceTab] = useState<
    'ledger' | 'signoff' | 'summary'
  >('ledger')
  const [ledgerView, setLedgerView] = useState<'month' | 'week'>('month')
  const [showExceptionsOnly, setShowExceptionsOnly] = useState(false)
  const [requestedEmployeeId, setRequestedEmployeeId] = useState(
    viewer.employeeId
  )
  const [periodMonth, setPeriodMonth] = useState(() =>
    formatPeriodMonth(getCurrentMonthDate())
  )
  const [industrial, setIndustrial] = useState(true)
  const [detailsRow, setDetailsRow] = useState<DayRow | null>(null)
  const [users, setUsers] = useState<EmployeeUser[]>([])
  const [policyConfig, setPolicyConfig] =
    useState<AttendancePolicyConfig | null>(null)
  const [clockEvents, setClockEvents] = useState<ClockEvent[]>([])
  const [timeCorrections, setTimeCorrections] = useState<
    AppliedTimeCorrection[]
  >([])
  const [requests, setRequests] = useState<EmployeeRequest[]>([])
  const [approval, setApproval] = useState<MonthlyTimesheetApproval | null>(
    null
  )
  const [correctionRow, setCorrectionRow] = useState<DayRow | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const [signNote, setSignNote] = useState('')
  const periodDate = useMemo(() => parsePeriodMonth(periodMonth), [periodMonth])
  const timesheetWindow = useMemo(
    () =>
      resolvePeriodWindowBounds(
        getCurrentMonthDate(),
        policyConfig?.periodWindows.timesheet ??
          getDefaultAttendancePolicyConfig().periodWindows.timesheet
      ),
    [policyConfig]
  )

  const periodLabel = useMemo(() => {
    try {
      return getPeriodParts(periodMonth, locale).label
    } catch {
      return periodMonth
    }
  }, [locale, periodMonth])
  const visibleUsers = useMemo(
    () => getTimesheetVisibleEmployees({ employees: users, viewer }),
    [users, viewer]
  )
  const selectedEmployeeId = useMemo(() => {
    if (visibleUsers.some((user) => user.id === requestedEmployeeId)) {
      return requestedEmployeeId
    }

    return (
      visibleUsers.find((user) => user.id === viewer.employeeId)?.id ??
      visibleUsers[0]?.id ??
      viewer.employeeId
    )
  }, [requestedEmployeeId, viewer.employeeId, visibleUsers])
  const selectedEmployee = useMemo(
    () => visibleUsers.find((user) => user.id === selectedEmployeeId),
    [selectedEmployeeId, visibleUsers]
  )
  const selectedEmployeeName = selectedEmployee
    ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`
    : DEFAULT_EMPLOYEE_NAME
  const selectedPersonLabel = selectedEmployee
    ? `${selectedEmployee.lastName}, ${selectedEmployee.firstName}`
    : t('timesheetUi.unknownEmployeeLabel')
  const selectedWorkContract = useMemo(() => {
    return resolveTimesheetWorkContract({
      employee: selectedEmployee,
      employeeId: selectedEmployeeId,
      policyConfig,
    })
  }, [policyConfig, selectedEmployee, selectedEmployeeId])
  const timesheetRows = useMemo(
    () =>
      buildEmployeeTimesheetRows({
        corrections: timeCorrections,
        employeeId: selectedEmployeeId,
        events: clockEvents,
        locale,
        periodMonth,
        requests,
        timeZone: workspaceTimeZone,
        workContract: selectedWorkContract,
      }),
    [
      clockEvents,
      periodMonth,
      requests,
      selectedEmployeeId,
      selectedWorkContract,
      timeCorrections,
      locale,
      workspaceTimeZone,
    ]
  )

  useEffect(() => {
    let isMounted = true

    Promise.all([
      selectedEmployeeId === viewer.employeeId
        ? loadMyClockEventsRange({
            employeeId: selectedEmployeeId,
            fromInclusive: startOfMonth(periodDate),
            toExclusive: startOfMonth(addMonths(periodDate, 1)),
          })
        : listClockEventsForEmployee(selectedEmployeeId),
      listTimeCorrectionsForEmployee(selectedEmployeeId),
      listEmployeeRequests(),
      applicationStore.getTimesheetApproval({
        employeeId: selectedEmployeeId,
        onSnapshot: ({ data }) => setApproval(data),
        periodMonth,
      }),
      applicationStore.listUsers({
        onSnapshot: ({ data }) => setUsers(data),
      }),
      getAttendancePolicyConfigBackendFirst(),
    ]).then(
      ([
        events,
        corrections,
        nextRequests,
        nextApproval,
        nextUsers,
        nextPolicyConfig,
      ]) => {
        if (!isMounted) return

        setClockEvents(events)
        setTimeCorrections(corrections)
        setRequests(nextRequests)
        setApproval(nextApproval)
        setUsers(nextUsers)
        setPolicyConfig(nextPolicyConfig)
      }
    )

    return () => {
      isMounted = false
    }
  }, [periodDate, periodMonth, selectedEmployeeId, viewer.employeeId])

  // The ledger only shows days that have happened, so the headline metrics must
  // use the same window. Measuring worked time that stops at today against a
  // target that ran to month end made an employee on plan look badly behind.
  const elapsedRows = useMemo(
    () => selectElapsedRows(timesheetRows, periodMonth),
    [periodMonth, timesheetRows]
  )
  const metrics = useMemo(() => getTimesheetMetrics(elapsedRows), [elapsedRows])
  const isPeriodInProgress =
    periodMonth === formatPeriodMonth(getCurrentMonthDate())

  const weekRows = useMemo(() => {
    const monthStart = startOfMonth(periodDate)
    const monthEnd = endOfMonth(periodDate)
    const today = new Date()
    const anchor =
      format(today, 'yyyy-MM') === format(periodDate, 'yyyy-MM')
        ? today
        : monthStart
    const weekStart = addDays(
      anchor,
      weekStartOffset(anchor, preferredWeekStart)
    )
    const weekEnd = addDays(weekStart, 6)
    const windowStart = weekStart < monthStart ? monthStart : weekStart
    const windowEnd = weekEnd > monthEnd ? monthEnd : weekEnd
    const startIso = format(windowStart, 'yyyy-MM-dd')
    const endIso = format(windowEnd, 'yyyy-MM-dd')

    return timesheetRows.filter(
      (row) => row.date >= startIso && row.date <= endIso
    )
  }, [periodDate, preferredWeekStart, timesheetRows])
  const exceptionRows = useMemo(
    () => timesheetRows.filter((row) => isException(row)),
    [timesheetRows]
  )
  const activeLedgerRows = useMemo(() => {
    const baseRows = ledgerView === 'week' ? weekRows : timesheetRows
    const visibleRows = selectElapsedRows(baseRows, periodMonth)

    return showExceptionsOnly
      ? visibleRows.filter((row) => isException(row))
      : visibleRows
  }, [ledgerView, periodMonth, showExceptionsOnly, timesheetRows, weekRows])
  const isLocked = approval?.status === 'signed'
  const canSelectEmployee = visibleUsers.length > 1
  const canExportPayroll = canViewFullAudit(viewer)
  const canRequestCorrection = selectedEmployeeId === viewer.employeeId
  const canSignSelectedTimesheet = selectedEmployee
    ? canSignEmployeeTimesheet({ employee: selectedEmployee, viewer })
    : false

  const openCorrection = (row: DayRow) => {
    setCorrectionRow(row)
  }

  const buildPayrollExport = () =>
    buildTimesheetPayrollExport({
      approval,
      employeeId: selectedEmployeeId,
      employeeName: selectedEmployeeName,
      // Totals are derived from the exact rows being exported so the file always
      // reconciles with its own line items, independently of the to-date figures
      // shown in the page header.
      metrics: getTimesheetMetrics(timesheetRows),
      periodMonth,
      rows: timesheetRows,
    })

  const exportPayroll = async () => {
    if (isExporting) return

    if (!canExportPayroll) {
      toast.error(t('timesheetPage.payrollRestricted'))
      return
    }

    setIsExporting(true)

    try {
      const exportData = buildPayrollExport()

      downloadCsvFile(
        `flowpro-payroll-${periodMonth}.csv`,
        buildPayrollCsv(exportData, locale)
      )

      if (approval) {
        setApproval(
          await timesheetWorkflow.markExported({ approval, kind: 'payroll' })
        )
      }

      toast.success(t('timesheetPage.payrollExported'))
    } catch (error) {
      toast.error(
        resolveApiErrorMessage(error, t, 'timesheetPage.exportFailed')
      )
    } finally {
      setIsExporting(false)
    }
  }

  const exportPdf = async () => {
    if (isExporting) return

    setIsExporting(true)

    try {
      const exportData = buildPayrollExport()
      const html = buildTimesheetPdfHtml(exportData, locale)
      const printWindow = window.open('', '_blank', 'noopener,noreferrer')

      if (!printWindow) {
        downloadTextFile(
          `flowpro-timesheet-${periodMonth}.html`,
          html,
          'text/html;charset=utf-8'
        )
        toast.info(t('timesheetPage.printBlocked'))
      } else {
        printWindow.document.write(html)
        printWindow.document.close()
        printWindow.focus()
        printWindow.print()
      }

      if (approval) {
        setApproval(
          await timesheetWorkflow.markExported({ approval, kind: 'pdf' })
        )
      }

      toast.success(t('timesheetPage.pdfPrepared'))
    } catch (error) {
      toast.error(
        resolveApiErrorMessage(error, t, 'timesheetPage.exportFailed')
      )
    } finally {
      setIsExporting(false)
    }
  }

  const signMonth = async () => {
    if (isSigning) return

    if (!canSignSelectedTimesheet) {
      toast.error(t('timesheetPage.signRestricted'))
      return
    }

    if (exceptionRows.length > 0) {
      toast.error(t('timesheetPage.resolveExceptions'))
      return
    }

    setIsSigning(true)

    try {
      const exportData = buildPayrollExport()
      const signed = await timesheetWorkflow.signMonthlyTimesheet({
        employeeId: selectedEmployeeId,
        note: signNote,
        periodMonth,
        snapshot: {
          rows: exportData.rows,
          totals: exportData.totals,
        },
        signedById: viewer.employeeId,
        signedByName: viewer.name,
      })

      setApproval(signed)
      setSignNote('')
      toast.success(t('timesheetPage.signedLocked'))
    } catch (error) {
      toast.error(resolveApiErrorMessage(error, t, 'timesheetPage.signFailed'))
    } finally {
      setIsSigning(false)
    }
  }

  return (
    <>
      <Header>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='max-w-full min-w-0 overflow-x-hidden'>
        <TimesheetPageHeader
          canExportPayroll={canExportPayroll}
          isExporting={isExporting}
          isLocked={isLocked}
          onExportPayroll={() => void exportPayroll()}
          onExportPdf={() => void exportPdf()}
          periodLabel={periodLabel}
          selectedEmployee={selectedEmployee}
          selectedEmployeeName={selectedEmployeeName}
        />

        <TimesheetControls
          canSelectEmployee={canSelectEmployee}
          industrial={industrial}
          maxPeriodDate={timesheetWindow.max}
          minPeriodDate={timesheetWindow.min}
          onIndustrialChange={setIndustrial}
          onPeriodMonthChange={(nextDate) => {
            setPeriodMonth(formatPeriodMonth(nextDate))
          }}
          onRequestedEmployeeChange={setRequestedEmployeeId}
          periodDate={periodDate}
          selectedEmployeeId={selectedEmployeeId}
          selectedPersonLabel={selectedPersonLabel}
          visibleUsers={visibleUsers}
        />

        <TimesheetMetricsGrid
          industrial={industrial}
          isPeriodInProgress={isPeriodInProgress}
          metrics={metrics}
        />

        <Tabs
          value={workspaceTab}
          onValueChange={(value) =>
            setWorkspaceTab(value as 'ledger' | 'signoff' | 'summary')
          }
          className='min-w-0 gap-4'
        >
          <TabsList className='w-full sm:w-fit'>
            <TabsTrigger value='ledger'>
              {t('timesheetUi.tabLedger')}
            </TabsTrigger>
            <TabsTrigger value='signoff'>
              {t('timesheetUi.tabSignOff')}
            </TabsTrigger>
            <TabsTrigger value='summary'>
              {t('timesheetUi.tabSummary')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value='ledger' className='space-y-4'>
            <TimesheetLedgerToolbar
              exceptionCount={exceptionRows.length}
              ledgerView={ledgerView}
              onLedgerViewChange={setLedgerView}
              onShowExceptionsOnlyChange={setShowExceptionsOnly}
              showExceptionsOnly={showExceptionsOnly}
              visibleRowCount={activeLedgerRows.length}
            />
            <TimesheetLedger
              emptyLabel={
                showExceptionsOnly
                  ? t('timesheetUi.noExceptionsInPeriod')
                  : undefined
              }
              industrial={industrial}
              rows={activeLedgerRows}
              isLocked={isLocked}
              canCorrectTime={canRequestCorrection}
              onCorrectTime={openCorrection}
              onOpenDetails={setDetailsRow}
            />
          </TabsContent>

          <TabsContent value='signoff'>
            <TimesheetSignOffPanel
              approval={approval}
              canSignSelectedTimesheet={canSignSelectedTimesheet}
              exceptionCount={exceptionRows.length}
              isLocked={isLocked}
              isSigning={isSigning}
              onReviewExceptions={() => {
                setShowExceptionsOnly(true)
                setWorkspaceTab('ledger')
              }}
              onSignMonth={() => void signMonth()}
              onSignNoteChange={setSignNote}
              signNote={signNote}
            />
          </TabsContent>

          <TabsContent value='summary'>
            <div className='grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]'>
              <PeriodSummary
                industrial={industrial}
                metrics={metrics}
                periodLabel={periodLabel}
              />
              <VacationBalance />
            </div>
          </TabsContent>
        </Tabs>

        <TimesheetDayDetailsDrawer
          canCorrectTime={canRequestCorrection}
          industrial={industrial}
          isLocked={isLocked}
          row={detailsRow}
          onCorrectTime={openCorrection}
          onOpenChange={(open) => {
            if (!open) setDetailsRow(null)
          }}
        />

        <TimeCorrectionDrawer
          employeeId={selectedEmployeeId}
          employeeName={selectedEmployeeName}
          policyConfig={policyConfig ?? getDefaultAttendancePolicyConfig()}
          row={correctionRow}
          users={users}
          onOpenChange={(open) => {
            if (!open) setCorrectionRow(null)
          }}
        />
      </Main>
    </>
  )
}

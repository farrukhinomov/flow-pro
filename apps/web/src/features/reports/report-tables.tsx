import type {
  EmployeePayrollReport,
  ReportsPackage,
} from '@/domain/reports/payroll'
import { useI18n } from '@/i18n'
import { BadgeCheck, Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export type ReportsSummary = {
  complianceIssues: number
  flexHours: number
  locked: number
  open: number
  paidHours: number
  targetHours: number
  workedHours: number
}

/**
 * The four report tables rendered inside the reports tabs.
 *
 * Split out of `components.tsx`, which held the summary cards, the export card,
 * the tab shell, and all four tables in one 598-line file. Each table has its
 * own columns, empty state, and skeleton, and none of them is used outside the
 * tab shell.
 */
export function PayrollApprovalsTable({
  employeeReports,
  isLoading,
}: {
  employeeReports: EmployeePayrollReport[]
  isLoading: boolean
}) {
  const { t } = useI18n()
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>
          {t('reportsUi.monthlyApprovals')}
        </CardTitle>
        <CardDescription>
          {t('reportsUi.monthlyApprovalsDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className='p-0'>
        <Table containerClassName='max-h-[68svh] overflow-auto'>
          <TableHeader className='sticky top-0 z-10 bg-background'>
            <TableRow>
              <TableHead>{t('requestsUi.employee')}</TableHead>
              <TableHead>{t('reportsUi.team')}</TableHead>
              <TableHead>{t('timesheetUi.worked')}</TableHead>
              <TableHead>{t('reportsUi.paid')}</TableHead>
              <TableHead>{t('timesheetUi.flex')}</TableHead>
              <TableHead>{t('requestsUi.status')}</TableHead>
              <TableHead>{t('reportsUi.exports')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <EmptyRow colSpan={7} label={t('reportsUi.loadingReports')} />
            ) : (
              employeeReports.map((employeeReport) => (
                <TableRow key={employeeReport.employee.id}>
                  <TableCell className='font-medium'>
                    {employeeReport.employee.firstName}{' '}
                    {employeeReport.employee.lastName}
                  </TableCell>
                  <TableCell>{employeeReport.employee.team}</TableCell>
                  <TableCell className='font-mono tabular-nums'>
                    {employeeReport.totals.workedHours.toFixed(2)}
                  </TableCell>
                  <TableCell className='font-mono tabular-nums'>
                    {employeeReport.totals.paidHours.toFixed(2)}
                  </TableCell>
                  <TableCell className='font-mono tabular-nums'>
                    {employeeReport.totals.flexHours.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        employeeReport.approval?.status === 'signed'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {employeeReport.approval?.status === 'signed'
                        ? t('reportsUi.signedAndLocked')
                        : t('reportsUi.openPeriod')}
                    </Badge>
                  </TableCell>
                  {/*
                    Naming only the exports that exist scans faster than a Yes/No pair for
                    every format, and matches how status is shown in the column beside it.
                  */}
                  <TableCell>
                    {employeeReport.approval?.payrollExportedAt ||
                    employeeReport.approval?.pdfExportedAt ? (
                      <div className='flex flex-wrap gap-1'>
                        {employeeReport.approval?.payrollExportedAt ? (
                          <Badge variant='secondary'>
                            {t('reportsUi.payroll')}
                          </Badge>
                        ) : null}
                        {employeeReport.approval?.pdfExportedAt ? (
                          <Badge variant='secondary'>
                            {t('reportsUi.pdf')}
                          </Badge>
                        ) : null}
                      </div>
                    ) : (
                      <span className='text-xs text-muted-foreground'>
                        {t('reportsUi.notExported')}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function BreakComplianceTable({
  employeeReports,
  isLoading,
  onExport,
}: {
  employeeReports: EmployeePayrollReport[]
  isLoading: boolean
  onExport: () => void
}) {
  const { t } = useI18n()
  return (
    <Card>
      <CardHeader className='gap-3 lg:flex-row lg:items-center lg:justify-between'>
        <div>
          <CardTitle className='text-base'>
            {t('reportsUi.legalBreakCompliance')}
          </CardTitle>
          <CardDescription>
            {t('reportsUi.legalBreakComplianceDescription')}
          </CardDescription>
        </div>
        <Button variant='outline' onClick={onExport}>
          <Download className='h-4 w-4' />
          {t('reportsUi.exportEvidence')}
        </Button>
      </CardHeader>
      <CardContent className='p-0'>
        <Table containerClassName='max-h-[68svh] overflow-auto'>
          <TableHeader className='sticky top-0 z-10 bg-background'>
            <TableRow>
              <TableHead>{t('requestsUi.employee')}</TableHead>
              <TableHead>{t('requestsUi.date')}</TableHead>
              <TableHead>{t('timesheetUi.worked')}</TableHead>
              <TableHead>{t('timesheetUi.break')}</TableHead>
              <TableHead>{t('reportsUi.required')}</TableHead>
              <TableHead>{t('requestsUi.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <SkeletonTableRows colSpan={6} rows={6} />
            ) : employeeReports.flatMap((employeeReport) =>
                employeeReport.days
                  .filter((day) => day.breakRequiredHours > 0)
                  .map((day) => (
                    <TableRow key={`${day.employeeId}-${day.date}`}>
                      <TableCell>{day.employeeName}</TableCell>
                      <TableCell>{day.date}</TableCell>
                      <TableCell>{day.workedHours.toFixed(2)}</TableCell>
                      <TableCell>{day.breakHours.toFixed(2)}</TableCell>
                      <TableCell>{day.breakRequiredHours.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            day.breakCompliant ? 'secondary' : 'destructive'
                          }
                        >
                          {day.breakCompliant
                            ? t('reportsUi.ok')
                            : t('reportsUi.missingBreak')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
              ).length === 0 ? (
              <EmptyRow
                colSpan={6}
                label={t('reportsUi.noLegalBreakEntries')}
              />
            ) : (
              employeeReports.flatMap((employeeReport) =>
                employeeReport.days
                  .filter((day) => day.breakRequiredHours > 0)
                  .map((day) => (
                    <TableRow key={`${day.employeeId}-${day.date}`}>
                      <TableCell>{day.employeeName}</TableCell>
                      <TableCell>{day.date}</TableCell>
                      <TableCell>{day.workedHours.toFixed(2)}</TableCell>
                      <TableCell>{day.breakHours.toFixed(2)}</TableCell>
                      <TableCell>{day.breakRequiredHours.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            day.breakCompliant ? 'secondary' : 'destructive'
                          }
                        >
                          {day.breakCompliant
                            ? t('reportsUi.ok')
                            : t('reportsUi.missingBreak')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
              )
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function AbsenceBalancesTable({
  isLoading,
  onExport,
  report,
}: {
  isLoading: boolean
  onExport: () => void
  report: ReportsPackage | null
}) {
  const { t } = useI18n()
  return (
    <Card>
      <CardHeader className='gap-3 lg:flex-row lg:items-center lg:justify-between'>
        <div>
          <CardTitle className='text-base'>
            {t('reportsUi.absenceBalanceReport')}
          </CardTitle>
          <CardDescription>
            {t('reportsUi.absenceBalanceReportDescription')}
          </CardDescription>
        </div>
        <Button variant='outline' onClick={onExport}>
          <Download className='h-4 w-4' />
          {t('reportsUi.exportCsv')}
        </Button>
      </CardHeader>
      <CardContent className='p-0'>
        <Table containerClassName='max-h-[68svh] overflow-auto'>
          <TableHeader className='sticky top-0 z-10 bg-background'>
            <TableRow>
              <TableHead>{t('requestsUi.employee')}</TableHead>
              <TableHead>{t('reportsUi.annual')}</TableHead>
              <TableHead>{t('reportsUi.approved')}</TableHead>
              <TableHead>{t('reportsUi.planned')}</TableHead>
              <TableHead>{t('reportsUi.remaining')}</TableHead>
              <TableHead>{t('reportsUi.sickness')}</TableHead>
              <TableHead>{t('common.homeOffice')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <SkeletonTableRows colSpan={7} rows={6} />
            ) : report?.absenceBalances.length ? (
              report.absenceBalances.map((balance) => (
                <TableRow key={balance.employeeId}>
                  <TableCell className='font-medium'>
                    {balance.employeeName}
                  </TableCell>
                  <TableCell>{balance.annualVacationDays}</TableCell>
                  <TableCell>{balance.approvedVacationDays}</TableCell>
                  <TableCell>{balance.plannedVacationDays}</TableCell>
                  <TableCell>{balance.remainingVacationDays}</TableCell>
                  <TableCell>{balance.sicknessDays}</TableCell>
                  <TableCell>{balance.homeOfficeDays}</TableCell>
                </TableRow>
              ))
            ) : (
              <EmptyRow colSpan={7} label={t('reportsUi.noAbsenceBalances')} />
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function TeamReportsTable({
  isLoading,
  onExport,
  report,
}: {
  isLoading: boolean
  onExport: () => void
  report: ReportsPackage | null
}) {
  const { t } = useI18n()
  return (
    <Card>
      <CardHeader className='gap-3 lg:flex-row lg:items-center lg:justify-between'>
        <div>
          <CardTitle className='text-base'>
            {t('reportsUi.managerTeamReport')}
          </CardTitle>
          <CardDescription>
            {t('reportsUi.managerTeamReportDescription')}
          </CardDescription>
        </div>
        <Button variant='outline' onClick={onExport}>
          <Download className='h-4 w-4' />
          {t('reportsUi.exportCsv')}
        </Button>
      </CardHeader>
      <CardContent className='p-0'>
        <Table containerClassName='max-h-[68svh] overflow-auto'>
          <TableHeader className='sticky top-0 z-10 bg-background'>
            <TableRow>
              <TableHead>{t('reportsUi.team')}</TableHead>
              <TableHead>{t('reportsUi.headcount')}</TableHead>
              <TableHead>{t('reportsUi.signed')}</TableHead>
              <TableHead>{t('reportsUi.open')}</TableHead>
              <TableHead>{t('timesheetUi.worked')}</TableHead>
              <TableHead>{t('timesheetUi.target')}</TableHead>
              <TableHead>{t('timesheetUi.flex')}</TableHead>
              <TableHead>{t('reportsUi.breakIssues')}</TableHead>
              <TableHead>{t('reportsUi.absenceDays')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <SkeletonTableRows colSpan={9} rows={5} />
            ) : report?.teamReports.length ? (
              report.teamReports.map((team) => (
                <TableRow key={team.team}>
                  <TableCell className='font-medium'>{team.team}</TableCell>
                  <TableCell>{team.headcount}</TableCell>
                  <TableCell>
                    <span className='inline-flex items-center gap-1'>
                      <BadgeCheck className='h-3.5 w-3.5 text-emerald-600' />
                      {team.signedPeriods}
                    </span>
                  </TableCell>
                  <TableCell>{team.openPeriods}</TableCell>
                  <TableCell>{team.workedHours.toFixed(2)}</TableCell>
                  <TableCell>{team.targetHours.toFixed(2)}</TableCell>
                  <TableCell>{team.flexHours.toFixed(2)}</TableCell>
                  <TableCell>{team.complianceIssues}</TableCell>
                  <TableCell>{team.approvedAbsenceDays}</TableCell>
                </TableRow>
              ))
            ) : (
              <EmptyRow colSpan={9} label={t('reportsUi.noTeamReportRows')} />
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className='py-10 text-center text-sm text-muted-foreground'
      >
        {label}
      </TableCell>
    </TableRow>
  )
}

function SkeletonTableRows({
  colSpan,
  rows,
}: {
  colSpan: number
  rows: number
}) {
  return Array.from({ length: rows }, (_, index) => (
    <TableRow key={index}>
      <TableCell colSpan={colSpan} className='py-3'>
        <div className='grid gap-2'>
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-5/6' />
        </div>
      </TableCell>
    </TableRow>
  ))
}

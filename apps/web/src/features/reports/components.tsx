import type {
  EmployeePayrollReport,
  ReportsPackage,
} from '@/domain/reports/payroll'
import { useI18n } from '@/i18n'
import { Download, FileSpreadsheet, FileText, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MetricCard } from '@/components/flowpro/metric-card'
import {
  AbsenceBalancesTable,
  BreakComplianceTable,
  PayrollApprovalsTable,
  TeamReportsTable,
} from './report-tables'

export type ReportsSummary = {
  complianceIssues: number
  flexHours: number
  locked: number
  open: number
  paidHours: number
  targetHours: number
  workedHours: number
}

type ExportKind = 'payroll' | 'balances' | 'teams' | 'excel' | 'pdf'

export function ReportsSummaryCards({
  isLoading = false,
  summary,
}: {
  isLoading?: boolean
  summary: ReportsSummary
}) {
  const { t } = useI18n()
  if (isLoading) {
    return (
      <div className='grid gap-3 md:grid-cols-3 xl:grid-cols-5'>
        {Array.from({ length: 5 }, (_, index) => (
          <MetricCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  return (
    <div className='grid gap-3 md:grid-cols-3 xl:grid-cols-5'>
      <MetricCard
        title={t('reportsUi.worked')}
        value={summary.workedHours.toFixed(2)}
        description={t('reportsUi.clockedProductiveHours')}
      />
      <MetricCard
        title={t('reportsUi.paid')}
        value={summary.paidHours.toFixed(2)}
        description={t('reportsUi.payrollRelevantPaidHours')}
      />
      <MetricCard
        title={t('timesheetUi.flex')}
        value={summary.flexHours.toFixed(2)}
        description={t('reportsUi.paidMinusTargetHours')}
      />
      <MetricCard
        title={t('reportsUi.locked')}
        value={summary.locked}
        description={t('reportsUi.openMonthlyPeriods', {
          count: String(summary.open),
        })}
      />
      <MetricCard
        title={t('reportsUi.breakIssues')}
        value={summary.complianceIssues}
        description={t('reportsUi.legalBreakComplianceWarnings')}
      />
    </div>
  )
}

export function PayrollPackageCard({
  isLoading = false,
  onExport,
  onSignVisible,
  periodMonth,
}: {
  isLoading?: boolean
  onExport: (kind: ExportKind) => void
  onSignVisible: () => void
  periodMonth: string
}) {
  const { t } = useI18n()
  return (
    <Card>
      <CardHeader className='gap-3 lg:flex-row lg:items-center lg:justify-between'>
        <div>
          <CardTitle className='text-base'>
            {t('reportsUi.payrollPackage')}
          </CardTitle>
          <CardDescription>
            {isLoading ? (
              <Skeleton className='mt-1 h-4 w-56' />
            ) : (
              t('reportsUi.exportVisibleEmployeeSet', { periodMonth })
            )}
          </CardDescription>
        </div>
        <div className='grid gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap'>
          {isLoading ? (
            Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className='h-10 w-full xl:w-36' />
            ))
          ) : (
            <>
              <Button variant='outline' onClick={() => onExport('payroll')}>
                <Download className='h-4 w-4' />
                {t('timesheetPage.payrollCsv')}
              </Button>
              <Button variant='outline' onClick={() => onExport('excel')}>
                <FileSpreadsheet className='h-4 w-4' />
                {t('reportsUi.excel')}
              </Button>
              <Button variant='outline' onClick={() => onExport('pdf')}>
                <FileText className='h-4 w-4' />
                {t('reportsUi.pdf')}
              </Button>
              <Button onClick={onSignVisible}>
                <LockKeyhole className='h-4 w-4' />
                {t('reportsUi.signVisiblePeriods')}
              </Button>
            </>
          )}
        </div>
      </CardHeader>
    </Card>
  )
}

export function ReportsTabs({
  employeeReports,
  isLoading,
  onExport,
  report,
}: {
  employeeReports: EmployeePayrollReport[]
  isLoading: boolean
  onExport: (kind: ExportKind) => void
  report: ReportsPackage | null
}) {
  const { t } = useI18n()
  return (
    <Tabs defaultValue='payroll' className='min-w-0 space-y-4'>
      <TabsList className='w-full sm:w-fit'>
        <TabsTrigger value='payroll'>{t('reportsUi.payroll')}</TabsTrigger>
        <TabsTrigger value='compliance'>
          {t('reportsUi.breakCompliance')}
        </TabsTrigger>
        <TabsTrigger value='balances'>
          {t('reportsUi.absenceBalances')}
        </TabsTrigger>
        <TabsTrigger value='teams'>{t('reportsUi.teams')}</TabsTrigger>
      </TabsList>

      <TabsContent value='payroll'>
        <PayrollApprovalsTable
          employeeReports={employeeReports}
          isLoading={isLoading}
        />
      </TabsContent>

      <TabsContent value='compliance'>
        <BreakComplianceTable
          employeeReports={employeeReports}
          isLoading={isLoading}
          onExport={() => onExport('payroll')}
        />
      </TabsContent>

      <TabsContent value='balances'>
        <AbsenceBalancesTable
          isLoading={isLoading}
          report={report}
          onExport={() => onExport('balances')}
        />
      </TabsContent>

      <TabsContent value='teams'>
        <TeamReportsTable
          isLoading={isLoading}
          report={report}
          onExport={() => onExport('teams')}
        />
      </TabsContent>
    </Tabs>
  )
}

function MetricCardSkeleton() {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <Skeleton className='h-4 w-24' />
        <Skeleton className='h-8 w-20' />
      </CardHeader>
      <CardContent>
        <Skeleton className='h-3 w-32' />
      </CardContent>
    </Card>
  )
}

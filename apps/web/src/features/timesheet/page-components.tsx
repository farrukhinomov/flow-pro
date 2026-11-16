import type { MonthlyTimesheetApproval } from '@/domain/attendance/types'
import type { EmployeeUser } from '@/domain/users/types'
import { useI18n } from '@/i18n'
import { formatLocaleDate } from '@/i18n/format'
import { FileDown, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { MonthYearPicker } from '@/components/flowpro/month-year-picker'
import { formatHours, formatNeutralHours } from './timesheet-formatting'
import type { TimesheetMetrics } from './types'

export function TimesheetPageHeader({
  canExportPayroll,
  isExporting,
  isLocked,
  onExportPayroll,
  onExportPdf,
  periodLabel,
  selectedEmployee,
  selectedEmployeeName,
}: {
  canExportPayroll: boolean
  isExporting: boolean
  isLocked: boolean
  onExportPayroll: () => void
  onExportPdf: () => void
  periodLabel: string
  selectedEmployee?: EmployeeUser
  selectedEmployeeName: string
}) {
  const { t } = useI18n()
  return (
    <div className='mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
      <div>
        <h1 className='text-2xl font-semibold tracking-tight'>
          {t('timesheetPage.title')}
        </h1>
        <p className='mt-1 text-sm text-muted-foreground'>
          {selectedEmployeeName} ·{' '}
          {selectedEmployee?.team ?? t('timesheetUi.selectedEmployee')} ·{' '}
          {periodLabel}
        </p>
      </div>
      <div className='flex flex-wrap gap-2'>
        <Badge
          variant='outline'
          className={cn(
            'w-fit',
            isLocked && 'border-emerald-200 bg-emerald-500/10 text-emerald-600'
          )}
        >
          {isLocked
            ? t('reportsUi.signedAndLocked')
            : t('reportsUi.openPeriod')}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline' size='sm' className='w-fit gap-2'>
              <FileDown className='h-4 w-4' />
              {t('teamAvailabilityUi.export')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuLabel>
              {t('teamAvailabilityUi.export')}
              <span className='mt-1 block max-w-56 text-xs font-normal whitespace-normal text-muted-foreground'>
                {t('timesheetPage.exportScope', {
                  employee: selectedEmployeeName,
                  period: periodLabel,
                })}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!canExportPayroll || isExporting}
              onSelect={onExportPayroll}
            >
              {t('timesheetPage.payrollCsv')}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isExporting} onSelect={onExportPdf}>
              {t('timesheetPage.exportPdf')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export function TimesheetControls({
  canSelectEmployee,
  industrial,
  maxPeriodDate,
  minPeriodDate,
  onIndustrialChange,
  onPeriodMonthChange,
  onRequestedEmployeeChange,
  periodDate,
  selectedEmployeeId,
  selectedPersonLabel,
  visibleUsers,
}: {
  canSelectEmployee: boolean
  industrial: boolean
  maxPeriodDate: Date
  minPeriodDate: Date
  onIndustrialChange: (checked: boolean) => void
  onPeriodMonthChange: (period: Date) => void
  onRequestedEmployeeChange: (employeeId: string) => void
  periodDate: Date
  selectedEmployeeId: string
  selectedPersonLabel: string
  visibleUsers: EmployeeUser[]
}) {
  const { t } = useI18n()
  return (
    <div className='mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
      <div className='grid w-full gap-2 sm:w-auto sm:grid-cols-[13rem_auto] sm:items-center'>
        <Select
          value={selectedEmployeeId}
          disabled={!canSelectEmployee}
          onValueChange={onRequestedEmployeeChange}
        >
          <SelectTrigger className='w-full' aria-label={t('usersUi.person')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {visibleUsers.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.lastName}, {user.firstName}
              </SelectItem>
            ))}
            {visibleUsers.length === 0 && (
              <SelectItem value={selectedEmployeeId}>
                {selectedPersonLabel}
              </SelectItem>
            )}
          </SelectContent>
        </Select>

        <MonthYearPicker
          max={maxPeriodDate}
          min={minPeriodDate}
          value={periodDate}
          onChange={onPeriodMonthChange}
          className='sm:w-72'
        />
      </div>

      <div className='flex items-center gap-2'>
        <Switch
          id='industrial'
          checked={industrial}
          onCheckedChange={onIndustrialChange}
        />
        <Label
          htmlFor='industrial'
          className='cursor-pointer text-sm text-muted-foreground'
        >
          {t('timesheetUi.decimalHours')}
        </Label>
      </div>
    </div>
  )
}

export function TimesheetLedgerToolbar({
  exceptionCount,
  ledgerView,
  onLedgerViewChange,
  onShowExceptionsOnlyChange,
  showExceptionsOnly,
  visibleRowCount,
}: {
  exceptionCount: number
  ledgerView: 'month' | 'week'
  onLedgerViewChange: (value: 'month' | 'week') => void
  onShowExceptionsOnlyChange: (value: boolean) => void
  showExceptionsOnly: boolean
  visibleRowCount: number
}) {
  const { t } = useI18n()

  return (
    <div className='flex flex-col gap-3 rounded-md border bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between'>
      <div className='inline-flex w-full rounded-md bg-muted p-1 sm:w-auto'>
        <Button
          type='button'
          size='sm'
          variant={ledgerView === 'month' ? 'secondary' : 'ghost'}
          className='h-8 flex-1 sm:flex-none'
          onClick={() => onLedgerViewChange('month')}
        >
          {t('timesheetUi.tabMonth')}
        </Button>
        <Button
          type='button'
          size='sm'
          variant={ledgerView === 'week' ? 'secondary' : 'ghost'}
          className='h-8 flex-1 sm:flex-none'
          onClick={() => onLedgerViewChange('week')}
        >
          {t('timesheetUi.tabWeek')}
        </Button>
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        <Button
          type='button'
          variant={showExceptionsOnly ? 'secondary' : 'outline'}
          size='sm'
          className='h-8 gap-2'
          onClick={() => onShowExceptionsOnlyChange(!showExceptionsOnly)}
        >
          {t('timesheetUi.exceptionsOnly')}
          <Badge variant='secondary' className='h-5 px-1.5 text-[10px]'>
            {exceptionCount}
          </Badge>
        </Button>
        <div className='text-sm text-muted-foreground'>
          {t('timesheetUi.rowsShown', { count: String(visibleRowCount) })}
        </div>
      </div>
    </div>
  )
}

export function TimesheetMetricsGrid({
  industrial,
  isPeriodInProgress = false,
  metrics,
}: {
  industrial: boolean
  /** An in-progress period only counts days up to today, so the target the
   * figures are measured against is the schedule so far, not the whole month. */
  isPeriodInProgress?: boolean
  metrics: TimesheetMetrics
}) {
  const { t } = useI18n()
  const items: Array<{
    helper: string
    label: string
    tone?: 'success' | 'danger'
    value: string
  }> = [
    {
      helper: `${t('reportsUi.paid')} ${formatNeutralHours(metrics.paid, industrial)}`,
      label: t('timesheetUi.worked'),
      value: formatNeutralHours(metrics.worked, industrial),
    },
    {
      helper: isPeriodInProgress
        ? t('timesheetUi.scheduledToDate')
        : t('timesheetUi.scheduledMonth'),
      label: t('timesheetUi.target'),
      value: formatNeutralHours(metrics.target, industrial),
    },
    {
      helper: t('timesheetUi.currentPeriodBalance'),
      label: t('timesheetUi.flex'),
      // Exactly on target is neither a surplus nor a shortfall, so it stays uncoloured.
      // Treating zero as a success turned the commonest balance into the greenest figure
      // on the page.
      tone:
        metrics.flex > 0 ? 'success' : metrics.flex < 0 ? 'danger' : undefined,
      value: formatHours(metrics.flex, industrial),
    },
    {
      helper: t('timesheetUi.recordedBreakTime'),
      label: t('timesheetUi.breaks'),
      value: formatNeutralHours(metrics.breaks, industrial),
    },
  ]

  return (
    <div className='mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border xl:grid-cols-4'>
      {items.map((item) => (
        <div key={item.label} className='min-w-0 bg-background px-3 py-2'>
          <div className='text-xs text-muted-foreground'>{item.label}</div>
          <div
            className={cn(
              'font-mono text-lg leading-6 font-semibold tabular-nums',
              item.tone === 'success' && 'text-emerald-600',
              item.tone === 'danger' && 'text-rose-600'
            )}
          >
            {item.value}
          </div>
          <div className='truncate text-xs text-muted-foreground'>
            {item.helper}
          </div>
        </div>
      ))}
    </div>
  )
}

export function TimesheetSignOffPanel({
  approval,
  canSignSelectedTimesheet,
  exceptionCount,
  isLocked,
  isSigning,
  onReviewExceptions,
  onSignMonth,
  onSignNoteChange,
  signNote,
}: {
  approval: MonthlyTimesheetApproval | null
  canSignSelectedTimesheet: boolean
  exceptionCount: number
  isLocked: boolean
  isSigning: boolean
  onReviewExceptions: () => void
  onSignMonth: () => void
  onSignNoteChange: (value: string) => void
  signNote: string
}) {
  const { locale, t } = useI18n()
  return (
    <Card>
      <CardContent className='flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex items-start gap-3'>
          <div className='flex h-10 w-10 items-center justify-center rounded-md border bg-muted text-muted-foreground'>
            <ShieldCheck className='h-4 w-4' />
          </div>
          <div>
            <div className='text-sm font-medium'>
              {t('reportsUi.monthlySignOff')}
            </div>
            <div className='mt-1 text-sm text-muted-foreground'>
              {isLocked
                ? t('timesheetUi.signedByOn', {
                    name: approval?.signedByName ?? '-',
                    date: approval?.signedAt
                      ? formatLocaleDate(approval.signedAt, locale, {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-',
                  })
                : canSignSelectedTimesheet
                  ? t('timesheetUi.signingLocksActions')
                  : t('timesheetUi.onlyAuthorizedCanSign')}
            </div>
          </div>
        </div>
        {!isLocked && canSignSelectedTimesheet && (
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
            <Input
              value={signNote}
              onChange={(event) => onSignNoteChange(event.target.value)}
              placeholder={t('timesheetUi.optionalSignOffNote')}
              className='sm:w-72'
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className='inline-flex'>
                  <Button
                    className='gap-2'
                    disabled={exceptionCount > 0 || isSigning}
                    onClick={onSignMonth}
                  >
                    <ShieldCheck className='h-4 w-4' />
                    {t('timesheetUi.signMonth')}
                  </Button>
                </span>
              </TooltipTrigger>
              {exceptionCount > 0 && (
                <TooltipContent>
                  {t('timesheetUi.resolveExceptionsBeforeSignOff')}
                </TooltipContent>
              )}
            </Tooltip>
            {exceptionCount > 0 && (
              <Button
                type='button'
                variant='link'
                className='h-auto justify-start p-0 text-xs text-amber-600'
                onClick={onReviewExceptions}
              >
                {t('timesheetUi.reviewExceptionsBeforeSignOff', {
                  count: exceptionCount,
                })}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

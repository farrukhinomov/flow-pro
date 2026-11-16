import { useI18n } from '@/i18n'
import { Umbrella } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatNeutralHours } from '../timesheet-formatting'
import { VACATION_BALANCE_STATS } from '../timesheet-view-model'
import type { SummaryRow, TimesheetMetrics } from '../types'

function SummaryCell({
  industrial,
  locale,
  strong,
  value,
}: {
  industrial: boolean
  locale: 'en' | 'de'
  strong?: boolean
  value?: string
}) {
  const numericValue = value ? Number(value) : undefined
  const formatted =
    numericValue === undefined || Number.isNaN(numericValue)
      ? (value ?? '')
      : formatNeutralHours(numericValue, industrial, locale)

  return (
    <TableCell
      className={cn(
        'text-right font-mono text-sm tabular-nums',
        strong && 'font-semibold',
        numericValue !== undefined &&
          numericValue > 0 &&
          strong &&
          'text-emerald-600',
        numericValue !== undefined &&
          numericValue < 0 &&
          strong &&
          'text-rose-600'
      )}
    >
      {formatted}
    </TableCell>
  )
}

export function PeriodSummary({
  industrial,
  metrics,
  periodLabel,
}: {
  industrial: boolean
  metrics: TimesheetMetrics
  periodLabel: string
}) {
  const { locale, t } = useI18n()
  const dynamicSummaryRows: SummaryRow[] = [
    {
      label: t('timesheetUi.workedHours'),
      sum: metrics.worked.toFixed(2),
      result: metrics.worked.toFixed(2),
    },
    {
      label: t('timesheetUi.paidHours'),
      sum: metrics.paid.toFixed(2),
      result: metrics.paid.toFixed(2),
    },
    {
      label: t('timesheetUi.targetHours'),
      sum: metrics.target.toFixed(2),
      result: metrics.target.toFixed(2),
    },
    {
      label: t('timesheetUi.flexBalance'),
      startValue: '0.00',
      sum: metrics.flex.toFixed(2),
      result: metrics.flex.toFixed(2),
      current: metrics.flex.toFixed(2),
    },
    {
      label: t('timesheetUi.breaks'),
      sum: metrics.breaks.toFixed(2),
      result: metrics.breaks.toFixed(2),
    },
  ]

  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='text-base'>
          {t('timesheetUi.periodSummary')} · {periodLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className='p-0'>
        <Table containerClassName='max-h-[66svh] overflow-auto'>
          <TableHeader className='sticky top-0 z-10 bg-background'>
            <TableRow>
              <TableHead>{t('timesheetUi.metric')}</TableHead>
              <TableHead className='text-right'>
                {t('timesheetUi.start')}
              </TableHead>
              <TableHead className='text-right'>
                {t('timesheetUi.sum')}
              </TableHead>
              <TableHead className='text-right'>
                {t('timesheetUi.result')}
              </TableHead>
              <TableHead className='text-right'>
                {t('timesheetUi.current')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dynamicSummaryRows.map((row, index) => (
              <TableRow
                key={row.label}
                className={cn(index % 2 === 1 && 'bg-muted/20')}
              >
                <TableCell className='text-sm text-muted-foreground'>
                  {row.label}
                </TableCell>
                <SummaryCell
                  industrial={industrial}
                  locale={locale}
                  value={row.startValue}
                />
                <SummaryCell
                  industrial={industrial}
                  locale={locale}
                  value={row.sum}
                />
                <SummaryCell
                  industrial={industrial}
                  locale={locale}
                  strong
                  value={row.result}
                />
                <SummaryCell
                  industrial={industrial}
                  locale={locale}
                  value={row.current}
                />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function VacationBalance() {
  const { t } = useI18n()
  const items = [
    {
      label: t('timesheetUi.vacationAnnualLeave'),
      value: VACATION_BALANCE_STATS.annual,
    },
    {
      label: t('timesheetUi.vacationDisability'),
      value: VACATION_BALANCE_STATS.disability,
    },
    {
      label: t('timesheetUi.vacationExtraHoliday1'),
      value: VACATION_BALANCE_STATS.extra1,
    },
    {
      label: t('timesheetUi.vacationExtraHoliday2'),
      value: VACATION_BALANCE_STATS.extra2,
    },
    {
      label: t('timesheetUi.vacationFromPreviousYear'),
      value: VACATION_BALANCE_STATS.fromPrev,
    },
    {
      label: t('timesheetUi.vacationExpired'),
      value: VACATION_BALANCE_STATS.expired,
    },
    {
      label: t('timesheetUi.vacationTaken'),
      value: VACATION_BALANCE_STATS.taken,
    },
    {
      label: t('timesheetUi.vacationRemaining'),
      value: VACATION_BALANCE_STATS.remaining,
      highlight: true,
    },
    {
      label: t('timesheetUi.vacationPlanned'),
      value: VACATION_BALANCE_STATS.planned,
    },
    {
      label: t('timesheetUi.vacationAvailable'),
      value: VACATION_BALANCE_STATS.available,
      highlight: true,
    },
  ]

  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Umbrella className='h-4 w-4 text-muted-foreground' />
          {t('timesheetUi.vacationYear', { year: '2026' })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-1'>
          {items.map(({ highlight, label, value }, index) => (
            <div key={label}>
              <div className='flex items-center justify-between py-2 text-sm'>
                <span className={cn(!highlight && 'text-muted-foreground')}>
                  {label}
                </span>
                <span
                  className={cn(
                    'font-mono tabular-nums',
                    highlight && 'font-semibold text-emerald-600'
                  )}
                >
                  {value.toFixed(1)}
                </span>
              </div>
              {index < items.length - 1 && <Separator />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

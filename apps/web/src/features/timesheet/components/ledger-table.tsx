import { useI18n } from '@/i18n'
import { formatLocaleDate } from '@/i18n/format'
import { CalendarDays, CalendarX2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/flowpro/empty-state'
import { FlowProDrawer } from '@/components/flowpro/flowpro-drawer'
import { formatHours } from '../timesheet-formatting'
import { isException } from '../timesheet-view-model'
import type { DayRow } from '../types'
import { DayBadges, DayIdentity } from './day-identity'
import { DayWorkChart, TimelineAxis, TimelineLegend } from './day-work-chart'
import { buildTimelineWindow } from './day-work-chart-utils'
import { Timeline } from './timeline'

function DetailBlock({
  label,
  tone = 'default',
  value,
}: {
  label: string
  tone?: 'default' | 'danger' | 'muted'
  value: string
}) {
  return (
    <div className='rounded-md border bg-background p-3'>
      <div className='text-xs text-muted-foreground'>{label}</div>
      <div
        className={cn(
          'mt-1 text-sm font-medium',
          tone === 'danger' && 'text-rose-600',
          tone === 'muted' && 'text-muted-foreground'
        )}
      >
        {value}
      </div>
    </div>
  )
}

function DayDetails({
  industrial,
  locale,
  row,
}: {
  industrial: boolean
  locale: 'en' | 'de'
  row: DayRow
}) {
  const { t } = useI18n()

  return (
    <div className='grid gap-3 md:grid-cols-2'>
      <DetailBlock
        label={t('requestsUi.clockIn')}
        value={row.clockIns.length ? row.clockIns.join(', ') : '-'}
      />
      <DetailBlock
        label={t('requestsUi.clockOut')}
        value={row.clockOuts.length ? row.clockOuts.join(', ') : '-'}
      />
      <DetailBlock
        label={t('timesheetUi.breakBalance')}
        value={formatHours(row.breakDiff, industrial, locale)}
        tone={(row.breakDiff ?? 0) < 0 ? 'danger' : 'muted'}
      />
      <DetailBlock
        label={t('timesheetUi.comment')}
        value={
          row.correction
            ? t('timesheetUi.correctedBy', {
                name: row.correction.approvedByName,
              })
            : (row.holidayName ??
              (row.absences.length ? row.absences.join(', ') : '-'))
        }
      />
    </div>
  )
}

export function TimesheetDayDetailsDrawer({
  canCorrectTime,
  industrial,
  isLocked,
  onCorrectTime,
  onOpenChange,
  row,
}: {
  canCorrectTime: boolean
  industrial: boolean
  isLocked: boolean
  onCorrectTime: (row: DayRow) => void
  onOpenChange: (open: boolean) => void
  row: DayRow | null
}) {
  const { locale, t } = useI18n()

  if (!row) return null

  const dayLabel = formatLocaleDate(`${row.date}T12:00:00`, locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const openCorrection = () => {
    const selectedRow = row

    onOpenChange(false)
    window.setTimeout(() => {
      onCorrectTime(selectedRow)
    }, 350)
  }

  return (
    <FlowProDrawer
      open={!!row}
      onOpenChange={onOpenChange}
      title={t('timesheetUi.dayDetails')}
      description={t('timesheetUi.dayDetailsDescription')}
      status={
        isException(row)
          ? t('timesheetUi.needsAttention')
          : t('timesheetUi.workday')
      }
      meta={dayLabel}
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            {t('common.close')}
          </Button>
          <Button
            type='button'
            disabled={isLocked || !canCorrectTime}
            onClick={openCorrection}
          >
            {t('requestsUi.correctTime')}
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <div className='flex flex-col gap-3 rounded-md border bg-muted/20 p-3'>
          <div className='flex items-start justify-between gap-3'>
            <DayIdentity row={row} />
            <DayBadges row={row} />
          </div>
          <Timeline row={row} />
        </div>

        <DayDetails industrial={industrial} locale={locale} row={row} />
      </div>
    </FlowProDrawer>
  )
}

export function TimesheetLedger({
  canCorrectTime,
  emptyLabel,
  industrial,
  isLocked,
  rows,
  onCorrectTime,
  onOpenDetails,
}: {
  canCorrectTime: boolean
  emptyLabel?: string
  industrial: boolean
  isLocked: boolean
  rows: DayRow[]
  onCorrectTime: (row: DayRow) => void
  onOpenDetails: (row: DayRow) => void
}) {
  const { t } = useI18n()
  const resolvedEmptyLabel = emptyLabel ?? t('timesheetUi.noRowsInThisView')
  const visibleRows = [...rows].sort((a, b) => b.date.localeCompare(a.date))
  const timelineWindow = buildTimelineWindow(visibleRows)

  return (
    <Card className='gap-4 overflow-hidden py-4'>
      <CardHeader className='gap-3 px-4 pb-0 sm:flex-row sm:items-start sm:justify-between'>
        <div className='space-y-1'>
          <CardTitle className='text-base'>
            {t('timesheetUi.myTimesheets')}
          </CardTitle>
          <CardDescription>
            {t('timesheetUi.timelineLedgerDescription')}
          </CardDescription>
        </div>
        <CardAction className='col-start-1 row-start-3 justify-self-start sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:justify-self-end'>
          <TimelineLegend />
        </CardAction>
      </CardHeader>
      <CardContent className='p-0'>
        {visibleRows.length === 0 ? (
          <EmptyState
            className='min-h-56 border-0 bg-transparent'
            icon={CalendarX2}
            title={resolvedEmptyLabel}
            description={t('timesheetUi.emptyDescription')}
          />
        ) : (
          <>
            {/*
              One column header for the whole ledger. The hour scale is shared by
              every row, and the metric captions never change, so repeating both
              on each of up to 31 rows was the bulk of the ledger's height and
              noise. Hidden below lg, where each row reads as its own card and
              still carries its own scale and captions.
            */}
            <div
              aria-hidden='true'
              className='hidden border-y bg-muted/40 px-3 py-2 lg:grid lg:grid-cols-[200px_minmax(0,1fr)_210px_130px] lg:items-end lg:gap-3'
            >
              <div className='text-xs font-medium text-muted-foreground'>
                {t('timesheetUi.day')}
              </div>
              <TimelineAxis window={timelineWindow} />
              <div className='grid grid-cols-3 gap-3 text-right text-xs font-medium text-muted-foreground'>
                <div>{t('requestsUi.duration')}</div>
                <div>{t('requestsUi.clockOut')}</div>
                <div>{t('timesheetUi.flex')}</div>
              </div>
              <div />
            </div>

            <div className='lg:max-h-[68svh] lg:overflow-y-auto lg:overscroll-contain'>
              {visibleRows.map((row) => {
                const rowSurfaceClass = row.isHoliday
                  ? 'bg-blue-500/5'
                  : row.isWeekend
                    ? 'bg-muted/30'
                    : 'bg-background'

                return (
                  <DayWorkChart
                    key={row.date}
                    action={
                      <div className='flex flex-wrap items-center justify-start gap-1 lg:justify-end'>
                        {/*
                          Labelled buttons on narrow layouts, icons once the rows
                          line up under a header: thirty repetitions of two
                          labelled buttons dominated the page. The accessible name
                          is kept either way.
                        */}
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          className='h-8 lg:w-8 lg:px-0'
                          aria-label={t('requestsUi.showDetails')}
                          title={t('requestsUi.showDetails')}
                          onClick={() => onOpenDetails(row)}
                        >
                          <CalendarDays className='h-4 w-4' />
                          <span className='lg:hidden'>
                            {t('requestsUi.showDetails')}
                          </span>
                        </Button>
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          className='h-8 lg:w-8 lg:px-0'
                          disabled={isLocked || !canCorrectTime}
                          aria-label={t('requestsUi.correctTime')}
                          title={t('requestsUi.correctTime')}
                          onClick={() => onCorrectTime(row)}
                        >
                          <Pencil className='h-4 w-4' />
                          <span className='lg:hidden'>
                            {t('requestsUi.correctTime')}
                          </span>
                        </Button>
                      </div>
                    }
                    className={cn(
                      rowSurfaceClass,
                      isException(row) &&
                        'shadow-[inset_2px_0_0_0_rgb(245,158,11)]'
                    )}
                    industrial={industrial}
                    row={row}
                    window={timelineWindow}
                    withSharedHeader
                  />
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

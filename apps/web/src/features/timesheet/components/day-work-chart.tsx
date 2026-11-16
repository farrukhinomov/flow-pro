import { useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import { useI18n } from '@/i18n'
import { formatLocaleDate } from '@/i18n/format'
import { cn, EMPTY_VALUE } from '@/lib/utils'
import {
  cleanTime,
  formatHours,
  formatNeutralHours,
  timeToMinutes,
} from '../timesheet-formatting'
import { getTimelineSegments } from '../timesheet-timeline'
import type { DayRow, TimelineSegment } from '../types'
import { DayBadges } from './day-identity'
import {
  clamp,
  getSegmentEndMinutes,
  type TimelineWindow,
} from './day-work-chart-utils'

const toneClass: Record<TimelineSegment['tone'], string> = {
  break: 'bg-sky-400',
  late: 'bg-rose-500',
  overtime: 'bg-amber-400',
  remote: 'bg-teal-500',
  work: 'bg-violet-500',
}

function formatTick(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:00`
}

function buildTicks({ endMinutes, startMinutes }: TimelineWindow) {
  const tickCount = 5
  const step = (endMinutes - startMinutes) / (tickCount - 1)

  return Array.from(
    { length: tickCount },
    (_, index) => Math.round((startMinutes + step * index) / 60) * 60
  )
}

function getRelativeDayLabel(
  date: string,
  locale: 'en' | 'de',
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  const today = new Date()
  const todayIso = format(today, 'yyyy-MM-dd')
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayIso = format(yesterday, 'yyyy-MM-dd')

  if (date === todayIso) return t('timesheetUi.today')
  if (date === yesterdayIso) return t('timesheetUi.yesterday')

  return formatLocaleDate(`${date}T12:00:00`, locale, {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  })
}

function getSegmentToneLabel(
  tone: TimelineSegment['tone'],
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  const labels: Record<TimelineSegment['tone'], string> = {
    break: t('timesheetUi.legendBreak'),
    late: t('timesheetUi.legendLate'),
    overtime: t('timesheetUi.legendOvertime'),
    remote: t('timesheetUi.badges.homeOffice'),
    work: t('timesheetUi.legendWorkingTime'),
  }

  return labels[tone]
}

function getSegmentEndLabel(
  segment: TimelineSegment,
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  if (!segment.end || timeToMinutes(segment.end) === undefined) {
    return t('timesheetUi.open')
  }

  return segment.end
}

function getSegmentDurationLabel(
  segment: TimelineSegment,
  industrial: boolean,
  locale: 'en' | 'de'
) {
  const startMinutes = timeToMinutes(segment.start)
  const endMinutes = timeToMinutes(segment.end)

  if (startMinutes === undefined || endMinutes === undefined) return undefined

  return formatNeutralHours(
    (endMinutes - startMinutes) / 60,
    industrial,
    locale
  )
}

function ChartSegmentBar({
  compact,
  durationLabel,
  endLabel,
  left,
  segment,
  toneLabel,
  t,
  width,
}: {
  compact: boolean
  durationLabel?: string
  endLabel: string
  left: number
  segment: TimelineSegment
  toneLabel: string
  t: (key: string, vars?: Record<string, string | number>) => string
  width: number
}) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const label = [
    `${toneLabel}: ${segment.start} - ${endLabel}`,
    durationLabel ? `${t('requestsUi.duration')} ${durationLabel}` : undefined,
    segment.marker,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div
      className='absolute top-1/2 z-10 -translate-y-1/2 overflow-visible'
      style={{
        left: `${clamp(left, 0, 100)}%`,
        width: `${Math.max(clamp(width, 0, 100), 1.4)}%`,
      }}
    >
      <button
        type='button'
        aria-label={label}
        title={label}
        onBlur={() => setIsTooltipOpen(false)}
        onFocus={() => setIsTooltipOpen(true)}
        onMouseEnter={() => setIsTooltipOpen(true)}
        onMouseLeave={() => setIsTooltipOpen(false)}
        className={cn(
          'block h-4 w-full cursor-help rounded-sm border-0 p-0 shadow-sm transition-[height,box-shadow] outline-none hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          compact && 'h-3',
          toneClass[segment.tone]
        )}
      />
      {isTooltipOpen && (
        <div
          role='tooltip'
          className='pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 min-w-max -translate-x-1/2 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-lg'
        >
          <div className='font-medium'>{toneLabel}</div>
          <div className='font-mono tabular-nums'>
            {segment.start} - {endLabel}
          </div>
          {durationLabel && (
            <div className='text-primary-foreground/80'>
              {t('requestsUi.duration')}: {durationLabel}
            </div>
          )}
          {segment.marker && (
            <div className='text-primary-foreground/80'>{segment.marker}</div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The hour scale for the timeline bars.
 *
 * Every ledger row shares one {@link TimelineWindow}, so the ticks are identical
 * on all of them. Exposing the scale as its own component lets the ledger render
 * it once in a column header instead of repeating it on every row.
 */
export function TimelineAxis({
  className,
  compact = false,
  window,
}: {
  className?: string
  compact?: boolean
  window: TimelineWindow
}) {
  const ticks = buildTicks(window)

  return (
    <div
      aria-hidden='true'
      className={cn(
        'relative h-4 text-[11px] text-muted-foreground',
        compact && 'h-3 text-[10px]',
        className
      )}
    >
      {ticks.map((tick, index) => {
        const left =
          ((tick - window.startMinutes) /
            (window.endMinutes - window.startMinutes)) *
          100

        return (
          <span
            key={tick}
            className={cn(
              'absolute font-mono tabular-nums',
              index === 0
                ? 'translate-x-0'
                : index === ticks.length - 1
                  ? '-translate-x-full'
                  : '-translate-x-1/2'
            )}
            style={{ left: `${left}%` }}
          >
            {formatTick(tick)}
          </span>
        )
      })}
    </div>
  )
}

export function TimelineLegend({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  const items: Array<{ className: string; label: string }> = [
    { className: toneClass.work, label: t('timesheetUi.legendWorkingTime') },
    { className: toneClass.remote, label: t('timesheetUi.badges.homeOffice') },
    { className: toneClass.break, label: t('timesheetUi.legendBreak') },
    { className: toneClass.overtime, label: t('timesheetUi.legendOvertime') },
    { className: toneClass.late, label: t('timesheetUi.legendLate') },
  ]

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground',
        compact && 'gap-x-3'
      )}
    >
      {items.map((item) => (
        <span key={item.label} className='inline-flex items-center gap-1.5'>
          <span className={cn('h-2 w-2 rounded-sm', item.className)} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

export function DayWorkChart({
  action,
  className,
  compact = false,
  industrial,
  row,
  showBadges = true,
  window,
  withSharedHeader = false,
}: {
  action?: ReactNode
  className?: string
  compact?: boolean
  industrial: boolean
  row: DayRow
  showBadges?: boolean
  window: TimelineWindow
  /**
   * Set when the parent renders one column header for all rows. The hour scale
   * and the metric captions are then hidden from wide layouts, where the header
   * is visible, but kept on narrow ones, where each row stands alone as a card.
   */
  withSharedHeader?: boolean
}) {
  const { locale, t } = useI18n()
  const segments = getTimelineSegments(row)
  const firstClockIn = cleanTime(row.clockIns[0]) || EMPTY_VALUE
  const lastClockOut = cleanTime(row.clockOuts[row.clockOuts.length - 1])
  const clockOut =
    row.clockOuts.length === 0
      ? '-'
      : lastClockOut && lastClockOut !== '--:--'
        ? lastClockOut
        : t('timesheetUi.open')
  const duration = formatNeutralHours(
    row.total ?? row.prod ?? 0,
    industrial,
    locale
  )
  const flex = formatHours(row.flex, industrial, locale)
  const rowTitle = getRelativeDayLabel(row.date, locale, t)
  const captionClass = withSharedHeader ? 'lg:hidden' : undefined

  return (
    <div
      className={cn(
        'grid min-w-0 gap-3 border-b px-3 py-3 last:border-b-0 lg:grid-cols-[200px_minmax(0,1fr)_210px_130px] lg:items-center',
        compact &&
          'grid-cols-1 items-start gap-2 px-4 py-2 sm:grid-cols-[140px_minmax(220px,1fr)_180px] sm:items-center',
        className
      )}
    >
      <div className='min-w-0 space-y-1.5'>
        <div className='flex min-w-0 items-center gap-2'>
          <div className='min-w-0'>
            <div className='truncate text-sm font-semibold'>{rowTitle}</div>
            <div className='text-xs text-muted-foreground'>
              {t('requestsUi.clockIn')} {firstClockIn}
            </div>
          </div>
        </div>
        {showBadges && <DayBadges row={row} />}
      </div>

      <div className={cn('min-w-0 space-y-1.5', compact && 'space-y-1')}>
        <TimelineAxis
          className={cn(withSharedHeader && 'lg:hidden')}
          compact={compact}
          window={window}
        />
        <div
          className={cn(
            'relative h-7 overflow-visible rounded-md bg-muted/60 ring-1 ring-border',
            compact && 'h-5'
          )}
        >
          <div className='absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-border/80' />
          {segments.map((segment) => {
            const startMinutes = timeToMinutes(segment.start)
            const endMinutes = getSegmentEndMinutes(segment)

            if (startMinutes === undefined) return null

            const left =
              ((startMinutes - window.startMinutes) /
                (window.endMinutes - window.startMinutes)) *
              100
            const width =
              ((endMinutes - startMinutes) /
                (window.endMinutes - window.startMinutes)) *
              100
            const toneLabel = getSegmentToneLabel(segment.tone, t)
            const endLabel = getSegmentEndLabel(segment, t)
            const durationLabel = getSegmentDurationLabel(
              segment,
              industrial,
              locale
            )

            return (
              <ChartSegmentBar
                key={segment.id}
                compact={compact}
                durationLabel={durationLabel}
                endLabel={endLabel}
                left={left}
                segment={segment}
                toneLabel={toneLabel}
                t={t}
                width={width}
              />
            )
          })}
        </div>
      </div>

      <div
        className={cn(
          'grid grid-cols-3 gap-3 text-xs lg:text-right',
          compact && 'gap-2 sm:text-right'
        )}
      >
        <div>
          <div className={cn('text-muted-foreground', captionClass)}>
            {t('requestsUi.duration')}
          </div>
          <div className='font-mono text-sm font-semibold tabular-nums'>
            {duration}
          </div>
        </div>
        <div>
          <div className={cn('text-muted-foreground', captionClass)}>
            {t('requestsUi.clockOut')}
          </div>
          <div className='font-mono text-sm font-semibold tabular-nums'>
            {clockOut}
          </div>
        </div>
        <div>
          <div className={cn('text-muted-foreground', captionClass)}>
            {t('timesheetUi.flex')}
          </div>
          <div
            className={cn(
              'font-mono text-sm font-semibold tabular-nums',
              (row.flex ?? 0) > 0 && 'text-emerald-600',
              (row.flex ?? 0) < 0 && 'text-rose-600'
            )}
          >
            {flex}
          </div>
        </div>
      </div>

      {action && (
        <div className='flex justify-start lg:justify-end'>{action}</div>
      )}
    </div>
  )
}

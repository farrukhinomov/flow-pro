import { useState } from 'react'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { timeToMinutes } from '../timesheet-formatting'
import { getTimelineSegments } from '../timesheet-timeline'
import type { DayRow, TimelineSegment } from '../types'

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

function TimelineSegmentBar({
  endLabel,
  segment,
  toneLabel,
}: {
  endLabel: string
  segment: TimelineSegment
  toneLabel: string
}) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const label = [`${toneLabel}: ${segment.start} - ${endLabel}`, segment.marker]
    .filter(Boolean)
    .join(', ')

  return (
    <div
      className='absolute top-2 z-10 h-4 overflow-visible'
      style={{
        left: `${segment.left}%`,
        width: `${segment.width}%`,
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
          'block h-full w-full cursor-help rounded-sm border-0 p-0 shadow-sm outline-none hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          segment.tone === 'work' && 'bg-violet-500',
          segment.tone === 'remote' && 'bg-teal-500',
          segment.tone === 'break' && 'bg-sky-400',
          segment.tone === 'overtime' && 'bg-amber-400',
          segment.tone === 'late' && 'bg-rose-500'
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
          {segment.marker && (
            <div className='text-primary-foreground/80'>{segment.marker}</div>
          )}
        </div>
      )}
    </div>
  )
}

export function Timeline({ row }: { row: DayRow }) {
  const { t } = useI18n()
  const segments = getTimelineSegments(row)

  if (segments.length === 0) {
    return (
      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
        <span className='h-2 w-2 rounded-full bg-muted-foreground/40' />
        {t('timesheetUi.noBookings')}
      </div>
    )
  }

  return (
    <div className='space-y-2'>
      <div className='relative h-8 overflow-visible rounded-md border bg-muted/40'>
        <div className='absolute top-1/2 right-3 left-3 h-px -translate-y-1/2 bg-border' />
        {segments.map((segment) => {
          const toneLabel = getSegmentToneLabel(segment.tone, t)
          const endLabel = getSegmentEndLabel(segment, t)

          return (
            <TimelineSegmentBar
              key={segment.id}
              endLabel={endLabel}
              segment={segment}
              toneLabel={toneLabel}
            />
          )
        })}
      </div>
      <div className='flex flex-wrap gap-1'>
        {segments.map((segment) => (
          <span
            key={`${segment.id}-label`}
            className='rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground'
          >
            {segment.start}-{segment.end || '--:--'}
            {segment.marker ? ` ${segment.marker}` : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

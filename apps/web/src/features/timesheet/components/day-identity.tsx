import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { getDayParts } from '../timesheet-formatting'
import { getDayBadges } from '../timesheet-view-model'
import type { DayRow } from '../types'

export function DayIdentity({ row }: { row: DayRow }) {
  const { locale, t } = useI18n()
  const parts = getDayParts(row, locale)

  return (
    <div className='flex min-w-0 items-center gap-2 sm:gap-3'>
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md border bg-background',
          row.isHoliday && 'border-blue-200 bg-blue-500/10',
          row.isWeekend && 'bg-muted'
        )}
      >
        <span className='text-[10px] text-muted-foreground uppercase'>
          {parts.month}
        </span>
        <span className='font-mono text-base font-semibold'>{parts.day}</span>
      </div>
      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm font-medium'>{parts.weekday}</div>
        <div className='truncate text-xs text-muted-foreground'>
          {row.holidayName ??
            (row.isWeekend
              ? t('timesheetUi.weekend')
              : t('timesheetUi.workday'))}
        </div>
      </div>
    </div>
  )
}

export function DayBadges({ row }: { row: DayRow }) {
  const { t } = useI18n()

  return (
    <div className='flex flex-wrap gap-1'>
      {getDayBadges(row).map(({ icon: Icon, labelKey, tone }) => (
        <Badge
          key={`${labelKey}-${tone}`}
          variant='outline'
          className={cn(
            'gap-1 text-[11px]',
            tone === 'muted' &&
              'border-slate-200 bg-slate-500/10 text-slate-600',
            tone === 'success' &&
              'border-emerald-200 bg-emerald-500/10 text-emerald-600',
            tone === 'warning' &&
              'border-amber-200 bg-amber-500/10 text-amber-600',
            tone === 'danger' && 'border-rose-200 bg-rose-500/10 text-rose-600',
            tone === 'remote' &&
              'border-fuchsia-200 bg-fuchsia-500/10 text-fuchsia-600',
            tone === 'default' && 'border-blue-200 bg-blue-500/10 text-blue-600'
          )}
        >
          {Icon && <Icon className='h-3 w-3' />}
          {t(labelKey)}
        </Badge>
      ))}
    </div>
  )
}

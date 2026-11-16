import { useMemo } from 'react'
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  getISOWeek,
  startOfMonth,
} from 'date-fns'
import { leadingBlankDays, orderedWeekdays } from '@/domain/attendance/week'
import type { PlanningEntry, PlanningPerson } from '@/domain/planning/types'
import { useI18n } from '@/i18n'
import { formatLocaleDate } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useUserPreferences } from '@/features/settings/use-user-preferences'
import {
  absenceStyles,
  buildPlanningDayMeta,
  dayNames,
  getAbsenceStyle,
  getEntryMap,
  type PlanningDayMeta,
} from './planning-view-model'

// absenceStyles aliases the legacy German codes (URL, KR) onto the same styles
// as their English counterparts (VAC, SICK) so both shapes of stored data
// render. The legend describes meanings rather than codes, so each distinct
// label is listed once.
const legendEntries = Object.entries(absenceStyles).filter(
  ([, style], index, entries) =>
    entries.findIndex(([, other]) => other.labelKey === style.labelKey) ===
    index
)

export function Legend() {
  const { t } = useI18n()
  return (
    <div className='flex flex-wrap items-center gap-3'>
      {legendEntries.map(([code, style]) => (
        <div key={code} className='flex items-center gap-1.5'>
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-bold',
              style.className
            )}
          >
            {style.short}
          </span>
          <span className='text-xs text-muted-foreground'>
            {t(style.labelKey)}
          </span>
        </div>
      ))}
      <div className='flex items-center gap-1.5'>
        <span className='rounded border bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground'>
          ...
        </span>
        <span className='text-xs text-muted-foreground'>
          {t('planningUi.confidential')}
        </span>
      </div>
    </div>
  )
}

export function BalanceSummary({ person }: { person: PlanningPerson }) {
  const { t } = useI18n()
  const counts = useMemo(() => {
    return person.entries.reduce(
      (acc, entry) => {
        if (entry.code === 'URL' || entry.code === 'VAC') acc.vacation += 1
        if (entry.code === 'HO') acc.homeOffice += 1
        if (entry.isPending) acc.pending += 1
        return acc
      },
      { vacation: 0, homeOffice: 0, pending: 0 }
    )
  }, [person])

  return (
    <div className='space-y-3 text-sm'>
      <div className='flex justify-between'>
        <span className='text-muted-foreground'>{t('usersUi.role')}</span>
        <span className='font-medium'>{person.role}</span>
      </div>
      <div className='flex justify-between'>
        <span className='text-muted-foreground'>
          {t('planningUi.vacationPlanned')}
        </span>
        <span className='font-mono font-medium'>{counts.vacation}</span>
      </div>
      <div className='flex justify-between'>
        <span className='text-muted-foreground'>
          {t('planningUi.homeOfficeDays')}
        </span>
        <span className='font-mono font-medium'>{counts.homeOffice}</span>
      </div>
      <div className='flex justify-between'>
        <span className='text-muted-foreground'>
          {t('planningUi.pendingLabel')}
        </span>
        <Badge variant={counts.pending ? 'secondary' : 'outline'}>
          {counts.pending}
        </Badge>
      </div>
    </div>
  )
}

export function PersonalYearCalendar({
  person,
  yearStart,
}: {
  person: PlanningPerson
  yearStart: Date
}) {
  const { locale, t } = useI18n()
  const { preferences } = useUserPreferences()
  const weekStart = preferences.weekStart
  // The header used the raw getDay()-indexed list, which is Sunday-first, while
  // the timesheet started weeks on Monday. Both now follow the account setting.
  const weekdayKeys = useMemo(
    () => orderedWeekdays(dayNames, weekStart),
    [weekStart]
  )
  const entryMap = getEntryMap(person)
  const months = Array.from(
    { length: 12 },
    (_, index) => new Date(yearStart.getFullYear(), index, 1)
  )

  return (
    <div className='h-[68svh] max-h-[620px] min-h-80 overflow-auto'>
      <div className='grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3'>
        {months.map((month) => {
          const dayMeta = buildPlanningDayMeta(
            eachDayOfInterval({
              start: startOfMonth(month),
              end: endOfMonth(month),
            })
          )

          return (
            <div key={month.toISOString()} className='rounded-lg border'>
              <div className='border-b px-3 py-2 text-sm font-medium'>
                {formatLocaleDate(month, locale, { month: 'long' })}
              </div>
              <div className='grid grid-cols-7 border-b bg-muted/30 text-center text-[10px] text-muted-foreground'>
                {weekdayKeys.map((day) => (
                  <div key={day} className='py-1'>
                    {t(day).slice(0, 2)}
                  </div>
                ))}
              </div>
              <div className='grid grid-cols-7'>
                {Array.from({
                  length: leadingBlankDays(startOfMonth(month), weekStart),
                }).map((_, index) => (
                  <div
                    key={`empty-${index}`}
                    className='aspect-square border-r border-b'
                  />
                ))}
                {dayMeta.map((day) => (
                  <CalendarCell
                    key={day.iso}
                    day={day}
                    entry={entryMap.get(day.iso)}
                    personName={person.name}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TeamMonthCalendar({
  month,
  people,
}: {
  month: Date
  people: PlanningPerson[]
}) {
  const { locale, t } = useI18n()
  // Every row of the grid reads the same per-day values, so they are derived
  // once for the month rather than once per person per cell.
  const dayMeta = useMemo(
    () =>
      buildPlanningDayMeta(
        eachDayOfInterval({
          start: startOfMonth(month),
          end: endOfMonth(month),
        })
      ),
    [month]
  )

  const weeks = useMemo(
    () =>
      dayMeta.reduce<{ week: number; days: PlanningDayMeta[] }[]>(
        (acc, day) => {
          const week = getISOWeek(day.date)
          const current = acc[acc.length - 1]

          if (!current || current.week !== week) {
            acc.push({ week, days: [day] })
          } else {
            current.days.push(day)
          }

          return acc
        },
        []
      ),
    [dayMeta]
  )

  return (
    <div className='flex h-[68svh] max-h-[620px] min-h-80 overflow-auto border-t'>
      <div className='sticky left-0 z-20 w-48 shrink-0 border-r bg-background'>
        <div className='border-b bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase'>
          {t('planningUi.people')}
        </div>
        <div className='border-b bg-muted/20 py-1.5 text-center text-[10px] text-muted-foreground'>
          {t('planningUi.calendarWeek')}
        </div>
        <div className='border-b py-1.5 text-center text-[10px] text-muted-foreground'>
          {t('planningUi.day')}
        </div>
        <div className='border-b py-1.5 text-center text-[10px] text-muted-foreground'>
          {t('planningUi.weekday')}
        </div>
        {people.map((person, index) => (
          <div
            key={person.id}
            className={cn(
              'flex h-8 items-center truncate border-b px-3 text-xs',
              index % 2 === 1 && 'bg-muted/20'
            )}
          >
            {person.name}
          </div>
        ))}
      </div>

      <div className='min-w-0 flex-1 overflow-x-auto'>
        <div className='min-w-max'>
          <div className='flex border-b bg-muted/40'>
            <div
              className='py-2 text-center text-xs font-semibold text-muted-foreground'
              style={{ width: dayMeta.length * 32 }}
            >
              {formatLocaleDate(month, locale, {
                month: 'long',
                year: 'numeric',
              })}
            </div>
          </div>
          <div className='flex border-b bg-muted/20'>
            {weeks.map(({ week, days: weekDays }) => (
              <div
                key={week}
                className='border-r py-1.5 text-center text-[10px] font-semibold text-muted-foreground'
                style={{ width: weekDays.length * 32 }}
              >
                {t('planningUi.calendarWeekShort')} {week}
              </div>
            ))}
          </div>
          <div className='flex border-b'>
            {dayMeta.map((day) => (
              <DayHeader key={day.iso} day={day} type='number' />
            ))}
          </div>
          <div className='flex border-b'>
            {dayMeta.map((day) => (
              <DayHeader key={day.iso} day={day} type='name' />
            ))}
          </div>

          {people.map((person, index) => {
            const entryMap = getEntryMap(person)

            return (
              <div
                key={person.id}
                className={cn(
                  'flex h-8 border-b',
                  index % 2 === 1 && 'bg-muted/10'
                )}
              >
                {dayMeta.map((day) => (
                  <CalendarCell
                    key={day.iso}
                    day={day}
                    entry={entryMap.get(day.iso)}
                    personName={person.name}
                    compact
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DayHeader({
  day,
  type,
}: {
  day: PlanningDayMeta
  type: 'number' | 'name'
}) {
  const { t } = useI18n()
  const { date, holidayName, kind } = day

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex w-8 shrink-0 items-center justify-center border-r py-1.5 text-[10px]',
              kind === 'holiday' && 'bg-blue-950/40 text-blue-300',
              kind === 'weekend' && 'bg-muted/60 text-muted-foreground',
              kind === 'weekday' && 'text-muted-foreground'
            )}
          >
            {type === 'number' ? format(date, 'd') : t(dayNames[getDay(date)])}
          </div>
        </TooltipTrigger>
        {holidayName && (
          <TooltipContent side='bottom' className='text-xs'>
            {holidayName}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}

function CalendarCell({
  day,
  entry,
  personName,
  compact,
}: {
  day: PlanningDayMeta
  entry?: PlanningEntry
  personName: string
  compact?: boolean
}) {
  const { locale, t } = useI18n()
  const { date, kind: dayKind } = day
  const sizeClass = compact ? 'h-8 w-8 text-[8px]' : 'aspect-square text-[10px]'
  const entryStyle = getAbsenceStyle(entry)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex shrink-0 items-center justify-center border-r border-b',
              sizeClass,
              dayKind === 'holiday' && 'bg-blue-950/20',
              dayKind === 'weekend' && 'bg-muted/40',
              dayKind === 'weekday' && 'bg-background'
            )}
          >
            {entry?.code ? (
              <span
                className={cn(
                  'flex h-full w-full items-center justify-center font-bold',
                  entryStyle.className,
                  entry.isPending && 'underline decoration-2 underline-offset-2'
                )}
                style={
                  entry.color ? { backgroundColor: entry.color } : undefined
                }
              >
                {compact ? entry.code : format(date, 'd')}
              </span>
            ) : entry?.isAnon ? (
              <span className='flex h-full w-full items-center justify-center bg-muted-foreground/20 text-muted-foreground'>
                ...
              </span>
            ) : (
              <span className='text-muted-foreground'>
                {compact ? '' : format(date, 'd')}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side='top' className='space-y-1 text-xs'>
          <div className='font-medium'>{personName}</div>
          <div className='text-muted-foreground'>
            {formatLocaleDate(date, locale, {
              weekday: 'short',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </div>
          {day.holidayName && <div>{day.holidayName}</div>}
          {entry?.code && (
            <div>
              {entry.label ??
                (entryStyle.labelKey ? t(entryStyle.labelKey) : entry.code)}
              {entry.isPending
                ? ` (${t('requests.status.submitted').toLowerCase()})`
                : ''}
            </div>
          )}
          {entry?.isAnon && <div>{t('planningUi.detailsHiddenByPolicy')}</div>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

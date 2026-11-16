import {
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from 'date-fns'
import { Link } from '@tanstack/react-router'
import {
  parseWorkPattern,
  type ApprovalImpactSimulation,
  type CoverageCandidate,
  type TeamCapacityDay,
} from '@/domain/planning/capacity'
import type { PlanningPerson } from '@/domain/planning/types'
import { useI18n } from '@/i18n'
import { formatLocaleDate } from '@/i18n/format'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EmptyState } from '@/components/flowpro/empty-state'
import { formatCapacityWarning } from './capacity-warning-format'
import { dayNames, getPublicHolidayName } from './planning-view-model'

export {
  BalanceSummary,
  Legend,
  PersonalYearCalendar,
  TeamMonthCalendar,
} from './calendar-components'

export function PlanningInsight({
  helper,
  icon: Icon,
  label,
  tone,
  value,
}: {
  helper: string
  icon: LucideIcon
  label: string
  tone: 'success' | 'remote' | 'warning' | 'muted'
  value: number
}) {
  return (
    <Card>
      <CardContent className='flex items-center gap-4 p-4'>
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-md border',
            tone === 'success' &&
              'border-emerald-200 bg-emerald-500/10 text-emerald-600',
            tone === 'remote' &&
              'border-fuchsia-200 bg-fuchsia-500/10 text-fuchsia-600',
            tone === 'warning' &&
              'border-amber-200 bg-amber-500/10 text-amber-600',
            tone === 'muted' && 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className='h-4 w-4' />
        </div>
        <div className='min-w-0'>
          <div className='text-sm text-muted-foreground'>{label}</div>
          <div className='font-mono text-2xl font-semibold tabular-nums'>
            {value}
          </div>
          <div className='truncate text-xs text-muted-foreground'>{helper}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export function CapacityForecast({
  days,
  month,
  people,
}: {
  days: TeamCapacityDay[]
  month: Date
  people: PlanningPerson[]
}) {
  const { locale, t } = useI18n()
  const dates = eachDayOfInterval({
    end: endOfMonth(month),
    start: startOfMonth(month),
  }).map((date) => format(date, 'yyyy-MM-dd'))
  const teams = Array.from(new Set(days.map((day) => day.team))).sort()
  const conflicts = days.filter((day) => day.status === 'conflict')

  return (
    <div className='grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]'>
      <Card className='min-h-0 overflow-hidden'>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>
            {t('planningUi.capacityForecast')}
          </CardTitle>
          <CardDescription>
            {t('planningUi.capacityForecastDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='h-[68svh] max-h-[620px] min-h-80 overflow-auto'>
            <div
              className='grid min-w-[920px] gap-1'
              style={{
                gridTemplateColumns: `150px repeat(${dates.length}, minmax(34px, 1fr))`,
              }}
            >
              <div />
              {dates.map((date) => (
                <div
                  key={date}
                  className='text-center text-[10px] text-muted-foreground'
                >
                  {format(parseISO(date), 'dd')}
                </div>
              ))}
              {teams.map((team) => (
                <div key={team} className='contents'>
                  <div className='flex items-center text-sm font-medium'>
                    {team}
                  </div>
                  {dates.map((date) => {
                    const day = days.find(
                      (item) => item.team === team && item.date === date
                    )
                    const holiday = getPublicHolidayName(date)

                    return (
                      <TooltipProvider key={`${team}-${date}`}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'flex h-9 items-center justify-center rounded-md border text-xs font-medium',
                                !day && 'bg-muted/30 text-muted-foreground',
                                day?.status === 'healthy' &&
                                  'border-emerald-200 bg-emerald-500/15 text-emerald-700',
                                day?.status === 'tight' &&
                                  'border-amber-200 bg-amber-500/15 text-amber-700',
                                day?.status === 'conflict' &&
                                  'border-rose-200 bg-rose-500/15 text-rose-700',
                                holiday && 'ring-1 ring-blue-300'
                              )}
                            >
                              {day ? day.available + day.remote : '-'}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className='space-y-1 text-xs'>
                            <div className='font-medium'>
                              {team} ·{' '}
                              {formatLocaleDate(date, locale, {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </div>
                            {holiday && <div>{holiday}</div>}
                            {day && (
                              <>
                                <div>
                                  {day.available + day.remote}/
                                  {day.minimumStaff} {t('planningUi.staffed')} ·{' '}
                                  {day.capacity.toFixed(1)} FTE
                                </div>
                                {day.warnings.map((warning) => (
                                  <div key={warning}>
                                    {formatCapacityWarning(warning, t)}
                                  </div>
                                ))}
                              </>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className='h-fit'>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>
            {t('planningUi.schedulingModel')}
          </CardTitle>
          <CardDescription>
            {t('planningUi.schedulingModelDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          {people
            .filter((person) => person.user.status === 'active')
            .map((person) => {
              const profile = parseWorkPattern(person.user.workPattern)

              return (
                <div key={person.id} className='rounded-md border p-3'>
                  <div className='flex items-center justify-between gap-3'>
                    <div className='min-w-0'>
                      <div className='truncate text-sm font-medium'>
                        {person.displayName}
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        {person.team} · {profile.label}
                      </div>
                    </div>
                    <Badge variant='outline'>
                      {profile.capacity.toFixed(1)} FTE
                    </Badge>
                  </div>
                  <div className='mt-2 text-xs text-muted-foreground'>
                    {t('planningUi.workdays')}:{' '}
                    {profile.workdays.length
                      ? profile.workdays
                          .map((day) => t(dayNames[day]))
                          .join(', ')
                      : t('planningUi.onDemand')}
                  </div>
                </div>
              )
            })}
          {conflicts.length > 0 && (
            <div className='rounded-md border border-amber-200 bg-amber-500/10 p-3 text-sm text-amber-700'>
              {t('planningUi.forecastConflictsNeedReview', {
                count: String(conflicts.length),
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function CoveragePlanner({
  candidates,
  date,
  team,
}: {
  candidates: CoverageCandidate[]
  date: string
  team: string
}) {
  const { locale, t } = useI18n()
  const available = candidates.filter(
    (candidate) => candidate.fit !== 'unavailable'
  )

  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='text-base'>
          {t('planningUi.whoCanCoverThisDay')}
        </CardTitle>
        <CardDescription>
          {team || t('planningUi.selectedTeam')} ·{' '}
          {formatLocaleDate(date, locale, {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className='grid gap-3 xl:grid-cols-2'>
        {available.length === 0 ? (
          <EmptyState
            className='min-h-48 xl:col-span-2'
            title={t('planningUi.noCoverCandidates')}
            description={t('planningUi.noCoverCandidatesDescription')}
          />
        ) : (
          candidates.map((candidate) => (
            <div key={candidate.id} className='rounded-md border p-4'>
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <div className='text-sm font-medium'>{candidate.name}</div>
                  <div className='mt-1 text-xs text-muted-foreground'>
                    {candidate.team} · {candidate.workPattern}
                  </div>
                </div>
                <Badge
                  variant='outline'
                  className={cn(
                    candidate.fit === 'strong' &&
                      'border-emerald-200 bg-emerald-500/10 text-emerald-600',
                    candidate.fit === 'possible' &&
                      'border-blue-200 bg-blue-500/10 text-blue-600',
                    candidate.fit === 'unavailable' &&
                      'border-slate-200 bg-slate-500/10 text-slate-600'
                  )}
                >
                  {t(`planningUi.fit.${candidate.fit}`)}
                </Badge>
              </div>
              <div className='mt-3 text-sm text-muted-foreground'>
                {candidate.reason}
              </div>
              <div className='mt-2 font-mono text-xs text-muted-foreground'>
                {t('planningUi.capacityValue', {
                  value: candidate.capacity.toFixed(1),
                })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

export function ApprovalImpactPanel({
  impacts,
}: {
  impacts: ApprovalImpactSimulation[]
}) {
  const { locale, t } = useI18n()
  if (impacts.length === 0) {
    return (
      <Card>
        <CardContent className='p-4'>
          <EmptyState
            className='min-h-56 border-0 bg-transparent'
            title={t('planningUi.noApprovalImpact')}
            description={t('planningUi.noApprovalImpactDescription')}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='grid gap-3 xl:grid-cols-2'>
      {impacts.map((impact) => {
        const hasConflict = impact.after.some(
          (day) => day.status === 'conflict'
        )

        return (
          <Card key={impact.requestId}>
            <CardHeader className='pb-3'>
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <CardTitle className='text-base'>
                    {impact.employeeName}
                  </CardTitle>
                  <CardDescription>
                    {impact.team} · {impact.affectedDates[0]}
                    {impact.affectedDates.length > 1
                      ? ` - ${impact.affectedDates[impact.affectedDates.length - 1]}`
                      : ''}
                  </CardDescription>
                </div>
                <Badge
                  variant='outline'
                  className={cn(
                    hasConflict
                      ? 'border-rose-200 bg-rose-500/10 text-rose-600'
                      : 'border-emerald-200 bg-emerald-500/10 text-emerald-600'
                  )}
                >
                  {hasConflict
                    ? t('teamAvailabilityUi.conflict')
                    : t('planningUi.noConflict')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className='space-y-3'>
              {impact.after.map((afterDay) => {
                const beforeDay = impact.before.find(
                  (day) => day.date === afterDay.date
                )

                return (
                  <div key={afterDay.date} className='rounded-md border p-3'>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='font-medium'>
                        {formatLocaleDate(afterDay.date, locale, {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                      <span className='font-mono text-muted-foreground'>
                        {beforeDay
                          ? beforeDay.available + beforeDay.remote
                          : '-'}{' '}
                        → {afterDay.available + afterDay.remote}{' '}
                        {t('planningUi.staffed')}
                      </span>
                    </div>
                    {afterDay.warnings.length > 0 && (
                      <div className='mt-2 text-xs leading-5 text-rose-600'>
                        {afterDay.warnings
                          .map((warning) => formatCapacityWarning(warning, t))
                          .join(' ')}
                      </div>
                    )}
                  </div>
                )
              })}
              <Button variant='outline' size='sm' className='w-full' asChild>
                <Link to='/requests' search={{ kind: undefined }}>
                  {t('planningUi.openApprovalQueue')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

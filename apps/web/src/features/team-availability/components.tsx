import {
  parseWorkPattern,
  type TeamCapacityDay,
} from '@/domain/planning/capacity'
import type {
  AvailabilityStatus,
  TeamAvailabilityMember,
} from '@/domain/planning/types'
import { useI18n } from '@/i18n'
import { formatLocaleDate } from '@/i18n/format'
import {
  AlertTriangle,
  CalendarX2,
  Home,
  UserCheck,
  UserMinus,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePaginatedRows } from '@/hooks/use-paginated-rows'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/flowpro/empty-state'
import { RowPagination } from '@/components/flowpro/row-pagination'
import { formatCapacityWarning } from '@/features/planning/capacity-warning-format'
import {
  availabilityStatusMeta,
  formatOptionalDate,
  getInitials,
  getVisibleNote,
} from './team-availability-view-model'

const statusIcons: Record<AvailabilityStatus, LucideIcon> = {
  absent: UserMinus,
  available: UserCheck,
  remote: Home,
  unavailable: UserMinus,
}

export function AvailabilityMetric({
  helper,
  label,
  tone,
  value,
}: {
  helper: string
  label: string
  tone: 'success' | 'remote' | 'danger' | 'default'
  value: number
}) {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-center justify-between gap-4'>
          <div>
            <p className='text-sm text-muted-foreground'>{label}</p>
            {/*
              Colour is only applied once the figure has something to say. Tinting it
              regardless of the value meant zero available capacity read as green, the
              healthiest colour on the page, and zero conflicts read as an alarm.
            */}
            <p
              className={cn(
                'mt-1 font-mono text-3xl font-semibold tabular-nums',
                value > 0 && tone === 'success' && 'text-emerald-600',
                value > 0 && tone === 'remote' && 'text-fuchsia-600',
                value > 0 && tone === 'danger' && 'text-rose-600'
              )}
            >
              {value}
            </p>
          </div>
          <div
            className={cn(
              'h-2.5 w-2.5 rounded-full',
              tone === 'success' && 'bg-emerald-500',
              tone === 'remote' && 'bg-fuchsia-500',
              tone === 'danger' && 'bg-rose-500',
              tone === 'default' && 'bg-blue-500'
            )}
          />
        </div>
        <p className='mt-2 text-xs text-muted-foreground'>{helper}</p>
      </CardContent>
    </Card>
  )
}

export function RosterGrid({
  emptyLabel,
  members,
}: {
  emptyLabel?: string
  members: TeamAvailabilityMember[]
}) {
  const { t } = useI18n()
  const resolvedEmptyLabel =
    emptyLabel ?? t('teamAvailabilityUi.noPeopleInAvailabilityView')
  if (members.length === 0) {
    return (
      <Card>
        <CardContent className='p-4'>
          <EmptyState
            className='min-h-56 border-0 bg-transparent'
            icon={CalendarX2}
            title={resolvedEmptyLabel}
            description={t('teamAvailabilityUi.adjustSearchDescription')}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='grid gap-3 xl:grid-cols-2'>
      {members.map((member) => (
        <MemberAvailabilityCard key={member.id} member={member} />
      ))}
    </div>
  )
}

export function ConflictPanel({
  conflictDays,
  tightDays,
}: {
  conflictDays: TeamCapacityDay[]
  tightDays: TeamCapacityDay[]
}) {
  const { locale, t } = useI18n()
  const highlighted = [...conflictDays, ...tightDays].slice(0, 8)

  return (
    <Card className='h-fit'>
      <CardContent className='p-4'>
        <div className='mb-3 flex items-center justify-between gap-3'>
          <div>
            <div className='text-sm font-medium'>
              {t('teamAvailabilityUi.managerWarnings')}
            </div>
            <p className='mt-1 text-xs text-muted-foreground'>
              {t('teamAvailabilityUi.staffingConflicts14Days')}
            </p>
          </div>
          <Badge
            variant='outline'
            className={cn(
              conflictDays.length
                ? 'border-rose-200 bg-rose-500/10 text-rose-600'
                : 'border-emerald-200 bg-emerald-500/10 text-emerald-600'
            )}
          >
            {conflictDays.length
              ? t('teamAvailabilityUi.conflictsCount', {
                  count: String(conflictDays.length),
                })
              : t('teamAvailabilityUi.clear')}
          </Badge>
        </div>

        {highlighted.length === 0 ? (
          <div className='rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground'>
            {t('teamAvailabilityUi.noStaffingWarnings')}
          </div>
        ) : (
          <div className='space-y-2'>
            {highlighted.map((day) => (
              <div
                key={`${day.team}-${day.date}`}
                className='rounded-md border p-3'
              >
                <div className='flex items-center justify-between gap-3 text-sm'>
                  <span className='font-medium'>
                    {day.team} ·{' '}
                    {formatLocaleDate(day.date, locale, {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                  <Badge
                    variant='outline'
                    className={cn(
                      day.status === 'conflict'
                        ? 'border-rose-200 bg-rose-500/10 text-rose-600'
                        : 'border-amber-200 bg-amber-500/10 text-amber-600'
                    )}
                  >
                    {day.status}
                  </Badge>
                </div>
                <div className='mt-2 text-xs leading-5 text-muted-foreground'>
                  {day.warnings[0]
                    ? formatCapacityWarning(day.warnings[0], t)
                    : t('teamAvailabilityUi.exactlyMinimumStaffing', {
                        current: String(day.available + day.remote),
                        minimum: String(day.minimumStaff),
                      })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function CapacityTable({ days }: { days: TeamCapacityDay[] }) {
  const { locale, t } = useI18n()
  // One row per team per day, so a month across several teams is hundreds.
  const pagination = usePaginatedRows(days)

  if (days.length === 0) {
    return (
      <Card>
        <CardContent className='p-4'>
          <EmptyState
            className='min-h-56 border-0 bg-transparent'
            icon={CalendarX2}
            title={t('teamAvailabilityUi.noCapacityRows')}
            description={t('teamAvailabilityUi.noCapacityRowsDescription')}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className='p-0'>
        <div className='max-h-[68svh] overflow-auto'>
          <table className='w-full min-w-[860px] text-sm'>
            <thead className='sticky top-0 z-10 border-b bg-muted text-xs text-muted-foreground'>
              <tr>
                <th className='px-4 py-3 text-left font-medium'>
                  {t('requestsUi.date')}
                </th>
                <th className='px-4 py-3 text-left font-medium'>
                  {t('reportsUi.team')}
                </th>
                <th className='px-4 py-3 text-right font-medium'>
                  {t('teamAvailabilityUi.scheduled')}
                </th>
                <th className='px-4 py-3 text-right font-medium'>
                  {t('teamAvailabilityUi.available')}
                </th>
                <th className='px-4 py-3 text-right font-medium'>
                  {t('teamAvailabilityUi.remote')}
                </th>
                <th className='px-4 py-3 text-right font-medium'>
                  {t('teamAvailabilityUi.capacity')}
                </th>
                <th className='px-4 py-3 text-right font-medium'>
                  {t('teamAvailabilityUi.minimum')}
                </th>
                <th className='px-4 py-3 text-left font-medium'>
                  {t('teamAvailabilityUi.decision')}
                </th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageRows.map((day) => (
                <tr key={`${day.team}-${day.date}`} className='border-b'>
                  <td className='px-4 py-3 font-mono text-muted-foreground'>
                    {formatLocaleDate(day.date, locale, {
                      day: '2-digit',
                      month: '2-digit',
                      weekday: 'short',
                    })}
                  </td>
                  <td className='px-4 py-3 font-medium'>{day.team}</td>
                  <td className='px-4 py-3 text-right font-mono'>
                    {day.scheduled}
                  </td>
                  <td className='px-4 py-3 text-right font-mono'>
                    {day.available}
                  </td>
                  <td className='px-4 py-3 text-right font-mono'>
                    {day.remote}
                  </td>
                  <td className='px-4 py-3 text-right font-mono'>
                    {day.capacity.toFixed(1)}
                  </td>
                  <td className='px-4 py-3 text-right font-mono'>
                    {day.minimumStaff}
                    {day.minimumOnSite
                      ? ` / ${day.minimumOnSite} ${t('teamAvailabilityUi.onsite')}`
                      : ''}
                  </td>
                  <td className='px-4 py-3'>
                    <CapacityStatusBadge day={day} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RowPagination pagination={pagination} />
      </CardContent>
    </Card>
  )
}

export function CapacityHeatmap({ days }: { days: TeamCapacityDay[] }) {
  const { locale, t } = useI18n()
  const teams = Array.from(new Set(days.map((day) => day.team))).sort()
  const dates = Array.from(new Set(days.map((day) => day.date))).sort()

  return (
    <Card>
      <CardContent className='p-4'>
        <div className='mb-4 flex items-center justify-between gap-3'>
          <div>
            <div className='text-sm font-medium'>
              {t('teamAvailabilityUi.departmentHeatmap')}
            </div>
            <p className='mt-1 text-xs text-muted-foreground'>
              {t('teamAvailabilityUi.heatmapDescription')}
            </p>
          </div>
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <span className='h-2.5 w-2.5 rounded-sm bg-emerald-500' />
            {t('teamAvailabilityUi.healthy')}
            <span className='h-2.5 w-2.5 rounded-sm bg-amber-500' />
            {t('teamAvailabilityUi.tight')}
            <span className='h-2.5 w-2.5 rounded-sm bg-rose-500' />
            {t('teamAvailabilityUi.conflict')}
          </div>
        </div>
        <div className='max-h-[68svh] overflow-auto'>
          <div
            className='grid min-w-[760px] gap-1'
            style={{
              gridTemplateColumns: `150px repeat(${dates.length}, minmax(42px, 1fr))`,
            }}
          >
            <div />
            {dates.map((date) => (
              <div
                key={date}
                className='text-center text-[11px] text-muted-foreground'
              >
                {formatLocaleDate(date, locale, {
                  day: '2-digit',
                  weekday: 'short',
                })}
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

                  return (
                    <div
                      key={`${team}-${date}`}
                      title={
                        day
                          ? `${team}: ${day.available + day.remote}/${day.minimumStaff} ${t('teamAvailabilityUi.staff')}, ${day.capacity.toFixed(1)} FTE`
                          : `${team}: ${t('teamAvailabilityUi.noSchedule')}`
                      }
                      className={cn(
                        'flex h-10 items-center justify-center rounded-md border text-xs font-medium',
                        !day && 'bg-muted/30 text-muted-foreground',
                        day?.status === 'healthy' &&
                          'border-emerald-200 bg-emerald-500/15 text-emerald-700',
                        day?.status === 'tight' &&
                          'border-amber-200 bg-amber-500/15 text-amber-700',
                        day?.status === 'conflict' &&
                          'border-rose-200 bg-rose-500/15 text-rose-700'
                      )}
                    >
                      {day ? day.available + day.remote : '-'}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CapacityStatusBadge({ day }: { day: TeamCapacityDay }) {
  const { t } = useI18n()
  const className =
    day.status === 'conflict'
      ? 'border-rose-200 bg-rose-500/10 text-rose-600'
      : day.status === 'tight'
        ? 'border-amber-200 bg-amber-500/10 text-amber-600'
        : 'border-emerald-200 bg-emerald-500/10 text-emerald-600'

  return (
    <Badge variant='outline' className={cn('gap-1 capitalize', className)}>
      {day.status === 'conflict' && <AlertTriangle className='h-3 w-3' />}
      {t(`teamAvailabilityUi.capacityStatus.${day.status}`)}
    </Badge>
  )
}

function MemberAvailabilityCard({
  member,
}: {
  member: TeamAvailabilityMember
}) {
  const { locale, t } = useI18n()
  const status = availabilityStatusMeta[member.status]
  const Icon = statusIcons[member.status]

  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex min-w-0 items-center gap-3'>
            <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-muted font-semibold'>
              {getInitials(member.name)}
            </div>
            <div className='min-w-0'>
              <div className='truncate text-sm font-medium'>{member.name}</div>
              <div className='truncate text-xs text-muted-foreground'>
                {member.role} · {member.team}
              </div>
            </div>
          </div>
          <Badge
            variant='outline'
            className={cn('w-fit gap-1', status.className)}
          >
            <Icon className='h-3 w-3' />
            {t(status.labelKey)}
          </Badge>
        </div>

        <div className='mt-4 grid gap-3 sm:grid-cols-3'>
          <InfoBlock
            label={t('teamAvailabilityUi.visibleDetail')}
            value={getVisibleNote(member, t)}
          />
          <InfoBlock
            label={t('teamAvailabilityUi.until')}
            value={formatOptionalDate(member.until, locale)}
          />
          <InfoBlock
            label={t('teamAvailabilityUi.nextWorkingDay')}
            value={formatOptionalDate(member.nextWorkingDay, locale)}
          />
        </div>

        <div className='mt-3 grid gap-3 sm:grid-cols-2'>
          <InfoBlock
            label={t('teamAvailabilityUi.workPattern')}
            value={parseWorkPattern(member.role).label}
          />
          <InfoBlock
            label={t('teamAvailabilityUi.capacity')}
            value={`${parseWorkPattern(member.role).capacity.toFixed(1)} FTE`}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-md border bg-muted/20 p-3'>
      <div className='text-xs text-muted-foreground'>{label}</div>
      <div className='mt-1 min-h-5 text-sm font-medium'>{value}</div>
    </div>
  )
}

import { addDays, format, isSameDay, parseISO } from 'date-fns'
import type { TeamCapacityDay } from '@/domain/planning/capacity'
import type {
  AvailabilityStatus,
  TeamAvailabilityMember,
} from '@/domain/planning/types'
import type { Locale } from '@/i18n'
import { formatDayMonth } from '@/i18n/format'
import { tStatic } from '@/i18n/static'
import { buildCsv } from '@/lib/csv'
import { EMPTY_VALUE } from '@/lib/utils'

export const availabilityStatusMeta: Record<
  AvailabilityStatus,
  {
    label: string
    labelKey: string
    className: string
  }
> = {
  available: {
    label: tStatic('teamAvailabilityUi.statusAvailable'),
    labelKey: 'teamAvailabilityUi.statusAvailable',
    className: 'border-emerald-200 bg-emerald-500/10 text-emerald-600',
  },
  remote: {
    label: tStatic('teamAvailabilityUi.statusRemote'),
    labelKey: 'teamAvailabilityUi.statusRemote',
    className: 'border-fuchsia-200 bg-fuchsia-500/10 text-fuchsia-600',
  },
  unavailable: {
    label: tStatic('teamAvailabilityUi.statusUnavailable'),
    labelKey: 'teamAvailabilityUi.statusUnavailable',
    className: 'border-slate-200 bg-slate-500/10 text-slate-600',
  },
  absent: {
    label: tStatic('teamAvailabilityUi.statusAbsent'),
    labelKey: 'teamAvailabilityUi.statusAbsent',
    className: 'border-rose-200 bg-rose-500/10 text-rose-600',
  },
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function formatOptionalDate(date: string | undefined, locale: Locale) {
  if (!date) return EMPTY_VALUE

  return formatDayMonth(date, locale)
}

export function getVisibleNote(
  member: TeamAvailabilityMember,
  translate?: (key: string) => string
) {
  if (member.policy === 'confidential') {
    return (
      translate?.('planningUi.detailsHiddenByPolicy') ??
      tStatic('planningUi.detailsHiddenByPolicy')
    )
  }
  if (member.policy === 'state-only') {
    const status = availabilityStatusMeta[member.status]
    return translate?.(status.labelKey) ?? status.label
  }

  const status = availabilityStatusMeta[member.status]
  return member.note ?? translate?.(status.labelKey) ?? status.label
}

export function filterTeamAvailabilityMembers(
  members: TeamAvailabilityMember[],
  search: string
) {
  const query = search.trim().toLowerCase()

  if (!query) return members

  return members.filter((member) =>
    `${member.name} ${member.role} ${member.team}`.toLowerCase().includes(query)
  )
}

export function getUnavailableMembers(members: TeamAvailabilityMember[]) {
  return members.filter((member) =>
    ['absent', 'unavailable'].includes(member.status)
  )
}

export function getRemoteMembers(members: TeamAvailabilityMember[]) {
  return members.filter((member) => member.status === 'remote')
}

export function getReturningSoonMembers({
  members,
  today,
  withinDays = 7,
}: {
  members: TeamAvailabilityMember[]
  today: Date
  withinDays?: number
}) {
  const threshold = addDays(today, withinDays)

  return members.filter((member) => {
    if (!member.until) return false

    const until = parseISO(member.until)

    return until <= threshold && !isSameDay(until, today)
  })
}

export function getCapacityDaysForDate(days: TeamCapacityDay[], date: Date) {
  const isoDate = format(date, 'yyyy-MM-dd')

  return days.filter((day) => day.date === isoDate)
}

export function buildTeamCapacityCsv(days: TeamCapacityDay[]) {
  const header = [
    tStatic('teamAvailabilityUi.csvHeaders.date'),
    tStatic('teamAvailabilityUi.csvHeaders.team'),
    tStatic('teamAvailabilityUi.csvHeaders.scheduled'),
    tStatic('teamAvailabilityUi.csvHeaders.available'),
    tStatic('teamAvailabilityUi.csvHeaders.remote'),
    tStatic('teamAvailabilityUi.csvHeaders.unavailable'),
    tStatic('teamAvailabilityUi.csvHeaders.capacityFte'),
    tStatic('teamAvailabilityUi.csvHeaders.minimumStaff'),
    tStatic('teamAvailabilityUi.csvHeaders.minimumOnsite'),
    tStatic('teamAvailabilityUi.csvHeaders.status'),
    tStatic('teamAvailabilityUi.csvHeaders.warnings'),
  ]
  const rows = days.map((day) => [
    day.date,
    day.team,
    day.scheduled,
    day.available,
    day.remote,
    day.unavailable,
    day.capacity.toFixed(1),
    day.minimumStaff,
    day.minimumOnSite,
    day.status,
    day.warnings.join(' | '),
  ])

  return buildCsv([header, ...rows])
}

export function getTeamCapacityExportName(date: Date) {
  return `flowpro-team-capacity-${format(date, 'yyyy-MM-dd')}.csv`
}

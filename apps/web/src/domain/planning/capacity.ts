import { addDays, eachDayOfInterval, format } from 'date-fns'
import type { EmployeeRequest } from '@/domain/requests/types'
import { tStatic } from '@/i18n/static'
import type { PlanningPerson } from './types'

export type ShiftKind = 'full-time' | 'part-time' | 'contract'

export type WorkPatternProfile = {
  kind: ShiftKind
  label: string
  workdays: number[]
  capacity: number
}

export type TeamStaffingRule = {
  team: string
  minimumStaff: number
  minimumOnSite?: number
}

export type TeamCapacityDay = {
  date: string
  team: string
  scheduled: number
  available: number
  remote: number
  unavailable: number
  capacity: number
  minimumStaff: number
  minimumOnSite: number
  status: 'healthy' | 'tight' | 'conflict'
  warnings: string[]
}

export type CoverageCandidate = {
  id: string
  name: string
  team: string
  workPattern: string
  capacity: number
  fit: 'strong' | 'possible' | 'unavailable'
  reason: string
}

export type ApprovalImpactSimulation = {
  requestId: string
  employeeName: string
  team: string
  affectedDates: string[]
  before: TeamCapacityDay[]
  after: TeamCapacityDay[]
  warnings: string[]
}

export const defaultTeamStaffingRules: TeamStaffingRule[] = [
  { team: 'Operations', minimumOnSite: 1, minimumStaff: 2 },
  { team: 'Support', minimumStaff: 1 },
  { team: 'Product', minimumStaff: 1 },
  { team: 'People', minimumStaff: 1 },
  { team: 'Finance', minimumStaff: 1 },
  { team: 'IT', minimumStaff: 1 },
]

function parseIsoDateAtLocalNoon(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export function parseWorkPattern(pattern: string): WorkPatternProfile {
  const normalized = pattern.toLowerCase()

  if (normalized.includes('part-time') || normalized.includes('mon-wed')) {
    return {
      capacity: 0.6,
      kind: 'part-time',
      label: tStatic('planningUi.workPatternLabels.partTime'),
      workdays: [1, 2, 3],
    }
  }

  if (normalized.includes('contract') || normalized.includes('on demand')) {
    return {
      capacity: 0,
      kind: 'contract',
      label: tStatic('planningUi.workPatternLabels.onDemand'),
      workdays: [],
    }
  }

  return {
    capacity: 1,
    kind: 'full-time',
    label: normalized.includes('hybrid')
      ? tStatic('planningUi.workPatternLabels.hybrid')
      : normalized.includes('office')
        ? tStatic('planningUi.workPatternLabels.officeFirst')
        : tStatic('planningUi.workPatternLabels.fullTime'),
    workdays: [1, 2, 3, 4, 5],
  }
}

function entryForDate(person: PlanningPerson, date: string) {
  return person.entries.find((entry) => entry.date === date)
}

function getRule(team: string, rules: TeamStaffingRule[]) {
  return (
    rules.find((rule) => rule.team === team) ?? {
      minimumStaff: 1,
      team,
    }
  )
}

export function calculateTeamCapacity({
  days = 14,
  people,
  rules = defaultTeamStaffingRules,
  startDate,
}: {
  days?: number
  people: PlanningPerson[]
  rules?: TeamStaffingRule[]
  startDate: Date
}) {
  const dates = Array.from({ length: days }, (_, index) =>
    format(addDays(startDate, index), 'yyyy-MM-dd')
  )
  const teams = Array.from(new Set(people.map((person) => person.team))).sort()

  return teams.flatMap((team) => {
    const teamPeople = people.filter(
      (person) => person.team === team && person.user.status === 'active'
    )
    const rule = getRule(team, rules)

    return dates.map<TeamCapacityDay>((date) => {
      const weekday = parseIsoDateAtLocalNoon(date).getDay()
      const scheduledPeople = teamPeople.filter((person) =>
        parseWorkPattern(person.user.workPattern).workdays.includes(weekday)
      )
      let available = 0
      let remote = 0
      let unavailable = 0
      let capacity = 0

      scheduledPeople.forEach((person) => {
        const profile = parseWorkPattern(person.user.workPattern)
        const entry = entryForDate(person, date)

        if (!entry) {
          available += 1
          capacity += profile.capacity
          return
        }

        if (entry.category === 'remote' || entry.code === 'HO') {
          remote += 1
          capacity += profile.capacity
          return
        }

        unavailable += 1
      })

      const onSite = available
      const warnings: string[] = []

      if (available + remote < rule.minimumStaff) {
        warnings.push(
          tStatic('planningUi.belowMinimumStaffingSentence', {
            team,
            current: available + remote,
            minimum: rule.minimumStaff,
          })
        )
      }

      if ((rule.minimumOnSite ?? 0) > 0 && onSite < (rule.minimumOnSite ?? 0)) {
        warnings.push(
          tStatic('planningUi.requiredOnsiteStaffSentence', {
            team,
            current: onSite,
            minimum: rule.minimumOnSite ?? 0,
          })
        )
      }

      const status =
        warnings.length > 0
          ? 'conflict'
          : available + remote === rule.minimumStaff
            ? 'tight'
            : 'healthy'

      return {
        available,
        capacity,
        date,
        minimumOnSite: rule.minimumOnSite ?? 0,
        minimumStaff: rule.minimumStaff,
        remote,
        scheduled: scheduledPeople.length,
        status,
        team,
        unavailable,
        warnings,
      }
    })
  })
}

export function findCoverageCandidates({
  date,
  people,
  team,
}: {
  date: string
  people: PlanningPerson[]
  team: string
}): CoverageCandidate[] {
  const weekday = parseIsoDateAtLocalNoon(date).getDay()

  return people
    .filter((person) => person.user.status === 'active')
    .map<CoverageCandidate>((person) => {
      const profile = parseWorkPattern(person.user.workPattern)
      const isScheduled = profile.workdays.includes(weekday)
      const entry = entryForDate(person, date)
      const isSameTeam = person.team === team
      const isAvailable =
        isScheduled &&
        (!entry || entry.code === 'HO' || entry.category === 'remote')
      const fit: CoverageCandidate['fit'] = !isAvailable
        ? 'unavailable'
        : isSameTeam
          ? 'strong'
          : 'possible'

      return {
        capacity: isAvailable ? profile.capacity : 0,
        fit,
        id: person.id,
        name: person.displayName,
        reason: !isScheduled
          ? tStatic('planningUi.coverageReasons.notScheduledByWorkPattern')
          : entry && entry.code !== 'HO' && entry.category !== 'remote'
            ? tStatic('planningUi.coverageReasons.alreadyUnavailable')
            : isSameTeam
              ? tStatic('planningUi.coverageReasons.sameTeamAndAvailable')
              : tStatic('planningUi.coverageReasons.availableCrossTeamCover'),
        team: person.team,
        workPattern: profile.label,
      }
    })
    .sort((a, b) => {
      const fitWeight = { strong: 0, possible: 1, unavailable: 2 }

      return fitWeight[a.fit] - fitWeight[b.fit] || b.capacity - a.capacity
    })
}

export function simulateApprovalImpact({
  people,
  request,
  rules = defaultTeamStaffingRules,
}: {
  people: PlanningPerson[]
  request: EmployeeRequest
  rules?: TeamStaffingRule[]
}): ApprovalImpactSimulation | null {
  const person = people.find(
    (candidate) =>
      candidate.id === request.employeeId ||
      candidate.displayName.toLowerCase() === request.employeeName.toLowerCase()
  )

  if (!person || request.kind === 'booking-correction' || !request.statusCode) {
    return null
  }

  const affectedDates = eachDayOfInterval({
    end: parseIsoDateAtLocalNoon(request.toDate),
    start: parseIsoDateAtLocalNoon(request.fromDate),
  }).map((date) => format(date, 'yyyy-MM-dd'))
  const days = Math.max(affectedDates.length, 1)
  const before = calculateTeamCapacity({
    days,
    people,
    rules,
    startDate: parseIsoDateAtLocalNoon(request.fromDate),
  }).filter((day) => day.team === person.team)
  const simulatedPeople = people.map((candidate) => {
    if (candidate.id !== person.id) return candidate

    return {
      ...candidate,
      entries: [
        ...candidate.entries,
        ...affectedDates.map((date) => ({
          category:
            request.statusCode === 'HO'
              ? ('remote' as const)
              : request.statusCode === 'OFF'
                ? ('unavailable' as const)
                : ('leave' as const),
          code: request.statusCode,
          date,
          isPending: true,
          label: request.statusLabel ?? request.subtype,
          visibility: 'operational' as const,
        })),
      ],
    }
  })
  const after = calculateTeamCapacity({
    days,
    people: simulatedPeople,
    rules,
    startDate: parseIsoDateAtLocalNoon(request.fromDate),
  }).filter((day) => day.team === person.team)
  const warnings = after.flatMap((day) => day.warnings)

  return {
    affectedDates,
    after,
    before,
    employeeName: person.displayName,
    requestId: request.id,
    team: person.team,
    warnings,
  }
}

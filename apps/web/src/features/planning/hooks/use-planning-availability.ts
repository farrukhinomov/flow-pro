import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { applicationStore } from '@/application/application-store'
import {
  readCurrentSyncMeta,
  startAttendanceAutoSync,
  subscribeToAttendanceSync,
} from '@/data/sync/sync-engine'
import { defaultViewer, type AppViewer } from '@/domain/access/access-control'
import type { SyncMeta } from '@/domain/attendance/types'
import type {
  AvailabilityStatus,
  PlanningEntry,
  PlanningPerson,
  TeamAvailabilityMember,
} from '@/domain/planning/types'
import type { EmployeeRequest } from '@/domain/requests/types'
import type { EmployeeUser } from '@/domain/users/types'
import { logger } from '@/lib/logger'
import { optionalSource } from '@/lib/optional-source'
import { formatPeriodMonth } from '@/lib/periods'

export type {
  AvailabilityStatus,
  PlanningEntry,
  PlanningPerson,
  TeamAvailabilityMember,
} from '@/domain/planning/types'

function getAvailabilityStatus(entry?: PlanningEntry): AvailabilityStatus {
  if (!entry) return 'available'
  if (entry.category === 'remote' || entry.code === 'HO') return 'remote'
  if (entry.category === 'unavailable') return 'unavailable'

  return 'absent'
}

function getNextWorkingDay(date: string) {
  const next = addDays(parseISO(date), 1)

  return format(next, 'yyyy-MM-dd')
}

function getVisiblePolicy(
  entry?: PlanningEntry
): TeamAvailabilityMember['policy'] {
  if (!entry) return 'state-only'
  if (entry.isAnon || entry.visibility === 'hidden') return 'confidential'
  if (entry.visibility === 'state-only') return 'state-only'
  if (entry.isPending) return 'state-only'

  return 'operational'
}

export function usePlanningAvailability(
  today = new Date(),
  viewer: AppViewer = defaultViewer
) {
  const periodMonth = formatPeriodMonth(today)
  const [requests, setRequests] = useState<EmployeeRequest[]>([])
  const [users, setUsers] = useState<EmployeeUser[]>([])
  const [people, setPeople] = useState<PlanningPerson[]>([])
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [planningPackage, nextSyncMeta] = await Promise.all([
        applicationStore.getPlanningPackage({
          onSnapshot: ({ data }) => {
            setPeople(data.people)
            setRequests(data.requests)
            setUsers(data.people.map((person) => person.user))
          },
          periodMonth,
          viewer,
        }),
        optionalSource(readCurrentSyncMeta(), null, 'sync status'),
      ])

      setPeople(planningPackage.people)
      setRequests(planningPackage.requests)
      setUsers(planningPackage.people.map((person) => person.user))
      setSyncMeta(nextSyncMeta)
    } catch (error) {
      // Keeps what the last successful load showed instead of an endless loading state.
      logger.error(error, 'Could not load planning')
    } finally {
      setIsLoading(false)
    }
  }, [periodMonth, viewer])

  useEffect(() => {
    startAttendanceAutoSync()
    const runRefresh = () => {
      void refresh()
    }
    const initialRefresh = window.setTimeout(runRefresh, 0)
    const unsubscribe = subscribeToAttendanceSync(runRefresh)

    return () => {
      window.clearTimeout(initialRefresh)
      unsubscribe()
    }
  }, [refresh])

  const members = useMemo(() => {
    const todayIso = format(today, 'yyyy-MM-dd')

    return people.map<TeamAvailabilityMember>((person) => {
      const todayEntry = person.entries.find((entry) => entry.date === todayIso)
      const futureEntries = person.entries
        .filter((entry) => entry.date >= todayIso)
        .sort((a, b) => a.date.localeCompare(b.date))
      const lastContinuousEntry = futureEntries.reduce<
        PlanningEntry | undefined
      >((last, entry) => {
        if (!todayEntry) return last
        if (!last) return entry.date === todayIso ? entry : last

        const expectedNext = format(
          addDays(parseISO(last.date), 1),
          'yyyy-MM-dd'
        )
        return entry.date === expectedNext ? entry : last
      }, undefined)

      return {
        id: person.id,
        name: person.displayName,
        role: person.user.role,
        team: person.team,
        status: getAvailabilityStatus(todayEntry),
        policy: getVisiblePolicy(todayEntry),
        until: todayEntry
          ? (lastContinuousEntry?.date ?? todayEntry.date)
          : undefined,
        note:
          todayEntry?.visibility === 'full' ||
          todayEntry?.visibility === 'operational'
            ? todayEntry.label
            : undefined,
        nextWorkingDay: todayEntry
          ? getNextWorkingDay(lastContinuousEntry?.date ?? todayEntry.date)
          : undefined,
      }
    })
  }, [people, today])

  return {
    isLoading,
    members,
    people,
    refresh,
    requests,
    syncMeta,
    users,
  }
}

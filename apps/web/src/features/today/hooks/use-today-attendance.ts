import { useCallback, useEffect, useRef, useState } from 'react'
import { attendanceWorkflow } from '@/application/attendance-workflow'
import {
  resolveApiErrorMessage,
  type StatusMessageKeys,
} from '@/data/api/api-error'
import { loadMyClockEventsRange } from '@/data/api/attendance.gateway'
import {
  readCurrentSyncMeta,
  subscribeToAttendanceSync,
} from '@/data/sync/sync-engine'
import { isSameCalendarDay } from '@/domain/attendance/calendar-day'
import {
  buildTodayProjection,
  isAttendanceCommandError,
} from '@/domain/attendance/commands'
import {
  type ClockEvent,
  type ClockEventDevice,
  type ClockEventGeo,
  type ClockEventType,
  type SyncMeta,
  type TodayProjection,
  type WorkLocation,
} from '@/domain/attendance/types'
import { useI18n } from '@/i18n'
import { toast } from 'sonner'
import { useSession } from '@/features/access/session-provider'
import { useWorkspaceTimeZone } from '@/features/attendance/use-workspace-time-zone'

export function useTodayAttendance(day?: Date) {
  const { session } = useSession()
  const { t } = useI18n()
  // Anchors which day a booking belongs to, so Today and the timesheet agree.
  const workspaceTimeZone = useWorkspaceTimeZone()
  const [defaultDay] = useState(() => new Date())
  const activeDay = day ?? defaultDay
  const employeeId = session.employeeId
  const [events, setEvents] = useState<ClockEvent[]>([])
  const [yesterdayEvents, setYesterdayEvents] = useState<ClockEvent[]>([])
  const [projection, setProjection] = useState<TodayProjection>(() =>
    buildTodayProjection([])
  )
  const [yesterdayProjection, setYesterdayProjection] =
    useState<TodayProjection>(() => buildTodayProjection([]))
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCommandPending, setIsCommandPending] = useState(false)
  const pendingEventsRef = useRef<ClockEvent[]>([])
  const confirmedEventsRef = useRef<ClockEvent[]>([])
  const commandInFlightRef = useRef(false)
  const localRevisionRef = useRef(0)

  const refresh = useCallback(async () => {
    const refreshRevision = localRevisionRef.current

    try {
      const yesterday = new Date(activeDay)
      yesterday.setDate(yesterday.getDate() - 1)
      const fromInclusive = new Date(yesterday)
      fromInclusive.setHours(0, 0, 0, 0)
      const toExclusive = new Date(activeDay)
      toExclusive.setDate(toExclusive.getDate() + 1)
      toExclusive.setHours(0, 0, 0, 0)

      const rangeEvents = await loadMyClockEventsRange({
        employeeId,
        fromInclusive,
        toExclusive,
      })
      const transientEvents = [
        ...confirmedEventsRef.current,
        ...pendingEventsRef.current,
      ]
      const [nextEvents, nextYesterdayEvents, nextSyncMeta] = await Promise.all(
        [
          Promise.resolve(
            mergeTransientEvents(
              rangeEvents.filter((event) =>
                isSameCalendarDay(
                  event.occurredAt,
                  activeDay,
                  workspaceTimeZone
                )
              ),
              activeDay,
              transientEvents
            )
          ),
          Promise.resolve(
            mergeTransientEvents(
              rangeEvents.filter((event) =>
                isSameCalendarDay(
                  event.occurredAt,
                  yesterday,
                  workspaceTimeZone
                )
              ),
              yesterday,
              transientEvents
            )
          ),
          readCurrentSyncMeta(),
        ]
      )

      setEvents((currentEvents) => {
        const nextEventsWithLatestLocalState = mergeTransientEvents(
          nextEvents,
          activeDay,
          [...confirmedEventsRef.current, ...pendingEventsRef.current]
        )
        const guardedEvents =
          refreshRevision !== localRevisionRef.current ||
          shouldKeepLocalProgress(nextEventsWithLatestLocalState, currentEvents)
            ? mergeTransientEvents(
                nextEventsWithLatestLocalState,
                activeDay,
                currentEvents
              )
            : nextEventsWithLatestLocalState

        setProjection(buildTodayProjection(guardedEvents))
        return guardedEvents
      })
      setYesterdayEvents(nextYesterdayEvents)
      setYesterdayProjection(
        buildTodayProjection(nextYesterdayEvents, yesterday)
      )
      setSyncMeta(nextSyncMeta)
    } catch (error) {
      setEvents([])
      setYesterdayEvents([])
      setProjection(buildTodayProjection([]))
      setYesterdayProjection(buildTodayProjection([]))
      setSyncMeta({
        isOnline: false,
        key: 'attendance-sync',
        lastError:
          error instanceof Error
            ? error.message
            : 'Unable to load attendance data.',
        pendingCount: 0,
      })
    } finally {
      setIsLoading(false)
    }
  }, [activeDay, employeeId, workspaceTimeZone])

  useEffect(() => {
    const runRefresh = () => {
      void refresh()
    }
    const initialRefresh = window.setTimeout(runRefresh, 0)

    const unsubscribe = subscribeToAttendanceSync(runRefresh)
    const interval = window.setInterval(runRefresh, 30_000)

    return () => {
      window.clearTimeout(initialRefresh)
      unsubscribe()
      window.clearInterval(interval)
    }
  }, [refresh])

  const runClockCommand = useCallback(
    async (
      type: ClockEventType,
      location?: WorkLocation,
      meta?: { device?: ClockEventDevice; geo?: ClockEventGeo }
    ) => {
      if (commandInFlightRef.current) return

      commandInFlightRef.current = true
      setIsCommandPending(true)
      localRevisionRef.current += 1
      const optimisticEvent = createOptimisticClockEvent({
        employeeId,
        location,
        meta,
        type,
      })
      pendingEventsRef.current = upsertClockEvent(
        pendingEventsRef.current,
        optimisticEvent
      )
      setEvents((currentEvents) => {
        const nextEvents = upsertClockEvent(currentEvents, optimisticEvent)
        setProjection(buildTodayProjection(nextEvents))
        return nextEvents
      })

      try {
        const event = await attendanceWorkflow.clock({
          day: activeDay,
          device: meta?.device,
          employeeId,
          geo: meta?.geo,
          location,
          type,
        })
        pendingEventsRef.current = removeClockEvent(
          pendingEventsRef.current,
          optimisticEvent.id
        )
        confirmedEventsRef.current = upsertClockEvent(
          confirmedEventsRef.current,
          event
        )
        setEvents((currentEvents) => {
          const nextEvents = upsertClockEvent(
            removeClockEvent(currentEvents, optimisticEvent.id),
            event
          )
          setProjection(buildTodayProjection(nextEvents))
          return nextEvents
        })
        toast.success(
          event.syncState === 'pending'
            ? t('todayUi.bookingQueuedOffline')
            : t('todayUi.bookingSaved')
        )
        void refresh()
      } catch (error) {
        pendingEventsRef.current = removeClockEvent(
          pendingEventsRef.current,
          optimisticEvent.id
        )
        setEvents((currentEvents) => {
          const nextEvents = removeClockEvent(currentEvents, optimisticEvent.id)
          setProjection(buildTodayProjection(nextEvents))
          return nextEvents
        })

        // Local domain guard fires before the request leaves the browser; the
        // shared resolver covers everything the server rejects.
        if (isAttendanceCommandError(error)) {
          toast.error(t(`todayUi.commandErrors.${error.code}`))
          return
        }
        toast.error(
          todayMutationErrorMessage(error, 'todayUi.unableToBookTime', t)
        )
      } finally {
        commandInFlightRef.current = false
        setIsCommandPending(false)
      }
    },
    [activeDay, employeeId, refresh, t]
  )

  const updateEvent = useCallback(
    async (event: ClockEvent, reason: string) => {
      try {
        const updatedEvent = await attendanceWorkflow.updateEvent(event, reason)
        localRevisionRef.current += 1
        confirmedEventsRef.current = upsertClockEvent(
          removeClockEvent(confirmedEventsRef.current, event.id),
          updatedEvent
        )
        setEvents((currentEvents) => {
          const nextEvents = upsertClockEvent(
            removeClockEvent(currentEvents, event.id),
            updatedEvent
          )
          setProjection(buildTodayProjection(nextEvents))
          return nextEvents
        })
        await refresh()
        toast.success(t('todayUi.clockEventUpdated'))
      } catch (error) {
        toast.error(
          todayMutationErrorMessage(error, 'todayUi.unableToUpdateEvent', t)
        )
      }
    },
    [refresh, t]
  )

  const removeEvent = useCallback(
    async (event: ClockEvent, reason: string) => {
      try {
        await attendanceWorkflow.removeEvent(event, reason)
        localRevisionRef.current += 1
        confirmedEventsRef.current = removeClockEvent(
          confirmedEventsRef.current,
          event.id
        )
        pendingEventsRef.current = removeClockEvent(
          pendingEventsRef.current,
          event.id
        )
        setEvents((currentEvents) => {
          const nextEvents = removeClockEvent(currentEvents, event.id)
          setProjection(buildTodayProjection(nextEvents))
          return nextEvents
        })
        await refresh()
        toast.success(t('todayUi.bookingRemovedFromToday'))
      } catch (error) {
        toast.error(
          todayMutationErrorMessage(error, 'todayUi.unableToRemoveBooking', t)
        )
      }
    },
    [refresh, t]
  )

  const closeYesterday = useCallback(
    async (time: string) => {
      try {
        await attendanceWorkflow.closePreviousDay({
          employeeId,
          referenceDay: activeDay,
          time,
        })
        localRevisionRef.current += 1
        await refresh()
        toast.success(t('todayUi.yesterdayClosed'))
      } catch (error) {
        toast.error(
          todayMutationErrorMessage(error, 'todayUi.unableToCloseYesterday', t)
        )
      }
    },
    [activeDay, employeeId, refresh, t]
  )

  return {
    closeYesterday,
    events,
    isCommandPending,
    isLoading,
    projection,
    syncMeta,
    removeEvent,
    updateEvent,
    yesterdayEvents,
    yesterdayProjection,
    clockIn: (
      location: WorkLocation,
      meta?: { device?: ClockEventDevice; geo?: ClockEventGeo }
    ) => runClockCommand('clock-in', location, meta),
    startBreak: () => runClockCommand('start-break'),
    resumeWork: () => runClockCommand('resume-work'),
    clockOut: () => runClockCommand('clock-out'),
    refresh,
  }
}

function createOptimisticClockEvent({
  employeeId,
  location,
  meta,
  type,
}: {
  employeeId: string
  location?: WorkLocation
  meta?: { device?: ClockEventDevice; geo?: ClockEventGeo }
  type: ClockEventType
}): ClockEvent {
  return {
    id: makeOptimisticEventId(),
    employeeId,
    type,
    occurredAt: new Date().toISOString(),
    location: type === 'clock-in' ? location : undefined,
    source: 'user',
    device: meta?.device,
    geo: meta?.geo,
    syncState: 'pending',
  }
}

function makeOptimisticEventId() {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    'randomUUID' in globalThis.crypto
  ) {
    return `optimistic-${globalThis.crypto.randomUUID()}`
  }

  return `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function removeClockEvent(events: ClockEvent[], id: string) {
  return events.filter((event) => event.id !== id)
}

/**
 * Attendance-specific 400/409 copy layered on the shared resolver.
 *
 * The generic resolver has no default for these statuses because "some details
 * are invalid" is worse than a caller's own wording; attendance genuinely has
 * better wording, so it supplies it here.
 */
const TODAY_STATUS_KEYS: StatusMessageKeys = {
  badRequest: 'todayUi.mutationErrors.validation',
  conflict: 'todayUi.mutationErrors.conflict',
  unavailable: 'todayUi.mutationErrors.unavailable',
}

function todayMutationErrorMessage(
  error: unknown,
  fallbackKey: string,
  t: ReturnType<typeof useI18n>['t']
) {
  return resolveApiErrorMessage(error, t, fallbackKey, TODAY_STATUS_KEYS)
}

function mergeTransientEvents(
  events: ClockEvent[],
  day: Date,
  transientEvents: ClockEvent[]
) {
  return transientEvents
    .filter((event) => isSameCalendarDay(event.occurredAt, day))
    .reduce(upsertClockEvent, events)
}

function shouldKeepLocalProgress(
  nextEvents: ClockEvent[],
  currentEvents: ClockEvent[]
) {
  if (currentEvents.length === 0) return false
  if (nextEvents.length === 0) return true
  if (currentEvents.length > nextEvents.length) return true

  return getLatestEventTime(currentEvents) > getLatestEventTime(nextEvents)
}

function getLatestEventTime(events: ClockEvent[]) {
  return Math.max(
    ...events.map((event) => new Date(event.occurredAt).getTime())
  )
}

function upsertClockEvent(events: ClockEvent[], event: ClockEvent) {
  return [...events.filter((item) => item.id !== event.id), event].sort(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) ||
      left.id.localeCompare(right.id)
  )
}

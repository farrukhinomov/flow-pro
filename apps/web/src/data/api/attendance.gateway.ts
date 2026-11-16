import {
  addClockEvent,
  listClockEventsForDay,
  listClockEventsForRange,
  refreshSyncMeta,
  removeClockEventFromCache,
  replaceClockEventsForRange,
  updateClockEvent,
} from '@/data/local/attendance.repo'
import {
  createClockCommand,
  isAttendanceCommandError,
} from '@/domain/attendance/commands'
import type { ClockEvent, OutboxOperation } from '@/domain/attendance/types'
import type { ClockEventReplayOutcome } from '@/domain/sync/protocol'
import {
  correctAttendanceBooking,
  createManualBooking,
  executeClockCommand,
  listMyAttendanceEvents,
  voidAttendanceBooking,
} from './attendance.api'
import { FlowProApiError } from './http-client'

type ClockCommandInput = Parameters<typeof executeClockCommand>[0]

export function buildOfflineClockCommand({
  currentEvents,
  input,
  now = new Date(),
}: {
  currentEvents: ClockEvent[]
  input: ClockCommandInput
  now?: Date
}) {
  return createClockCommand({
    currentEvents,
    device: input.device,
    employeeId: input.clientEmployeeId,
    geo: input.geo,
    location: input.location,
    now,
    source: 'user',
    type: input.type,
  })
}

export async function loadMyClockEventsRange({
  employeeId,
  fromInclusive,
  toExclusive,
}: {
  employeeId: string
  fromInclusive: Date
  toExclusive: Date
}) {
  try {
    const events = await listMyAttendanceEvents({
      clientEmployeeId: employeeId,
      fromInclusive,
      toExclusive,
    })

    await replaceClockEventsForRange(
      employeeId,
      fromInclusive,
      toExclusive,
      events
    )
    await refreshSyncMeta({
      isOnline: true,
      lastError: undefined,
      lastSyncedAt: new Date().toISOString(),
    })

    return events
  } catch (error) {
    if (!shouldFallbackToLocalAttendance(error)) {
      throw error
    }

    await refreshSyncMeta({
      isOnline: false,
      lastError:
        error instanceof Error ? error.message : 'FlowPro API is unavailable.',
    })

    return listClockEventsForRange(employeeId, fromInclusive, toExclusive)
  }
}

export const attendanceGateway = {
  async clock(input: ClockCommandInput) {
    try {
      return cacheCanonicalEvent(await executeClockCommand(input))
    } catch (error) {
      if (!shouldFallbackToLocalAttendance(error)) {
        throw error
      }

      const now = new Date()
      const currentEvents = await listClockEventsForDay(
        input.clientEmployeeId,
        now
      )
      const { event, operation } = buildOfflineClockCommand({
        currentEvents,
        input,
        now,
      })

      await addClockEvent(event, operation)
      await refreshSyncMeta({
        isOnline: false,
        lastError:
          error instanceof Error
            ? error.message
            : 'FlowPro API is unavailable.',
      })

      return event
    }
  },

  async correct(event: ClockEvent, reason: string) {
    const corrected = await correctAttendanceBooking({ event, reason })
    await removeClockEventFromCache(event.id)
    return cacheCanonicalEvent(corrected)
  },

  async createManual(input: Parameters<typeof createManualBooking>[0]) {
    return cacheCanonicalEvent(await createManualBooking(input))
  },

  async void(event: ClockEvent, reason: string) {
    await voidAttendanceBooking({ event, reason })
    await removeClockEventFromCache(event.id)
    await refreshSyncMeta({
      isOnline: true,
      lastError: undefined,
      lastSyncedAt: new Date().toISOString(),
    })
  },
}

/**
 * Re-exported from the domain so the replay contract has a single definition
 * shared by the gateway and the pure resolver used by the sync engine.
 */
export type ReplayClockEventResult = ClockEventReplayOutcome

/**
 * Replays an offline `clock-event.create` outbox operation through the
 * authoritative /attendance/commands/* endpoint and reconciles the local cache
 * with the server's canonical booking.
 *
 * The outbox operation id is reused as a stable Idempotency-Key so a retry after a
 * lost acknowledgement replays the same booking instead of duplicating it.
 *
 * - Returns `synced` once the server has persisted the booking.
 * - Returns `rejected` when the server declines the command for a terminal reason
 *   (for example an invalid state transition caused by another device). The caller
 *   should stop retrying and surface it rather than loop forever.
 * - Throws for transient/unavailable failures so the caller can retry later.
 */
export async function replayClockEvent(
  operation: OutboxOperation
): Promise<ReplayClockEventResult> {
  const event = operation.payload as ClockEvent

  try {
    const canonical = await executeClockCommand(
      {
        clientEmployeeId: event.employeeId,
        device: event.device,
        geo: event.geo,
        location: event.location,
        type: event.type,
      },
      operation.id
    )

    if (canonical.id !== event.id) {
      await removeClockEventFromCache(event.id)
    }

    await cacheCanonicalEvent(canonical)

    return { status: 'synced', syncedAt: new Date().toISOString() }
  } catch (error) {
    if (shouldFallbackToLocalAttendance(error)) {
      throw error
    }

    const message = isAttendanceCommandError(error)
      ? error.code
      : error instanceof Error
        ? error.message
        : 'The clock event was rejected by the server.'

    return { status: 'rejected', message }
  }
}

async function cacheCanonicalEvent(event: ClockEvent) {
  await updateClockEvent(event)
  await refreshSyncMeta({
    isOnline: true,
    lastError: undefined,
    lastSyncedAt: new Date().toISOString(),
  })

  return event
}

export function shouldFallbackToLocalAttendance(error: unknown) {
  return (
    error instanceof FlowProApiError &&
    (error.status === undefined || error.status >= 500)
  )
}

import type { OutboxOperation } from '@/domain/attendance/types'

export type SyncProtocolVersion = 'flowpro-sync-v1'

export type SyncBatchRequest = {
  protocol: SyncProtocolVersion
  clientId: string
  schemaVersion: number
  operations: OutboxOperation[]
}

export type SyncConflict = {
  operationId: string
  aggregate: OutboxOperation['aggregate']
  aggregateId: string
  message: string
  serverVersion: string
  remotePayload: unknown
}

export type SyncBatchResponse = {
  accepted: {
    operationId: string
    serverVersion: string
    syncedAt: string
  }[]
  conflicts: SyncConflict[]
  rejected: {
    operationId: string
    message: string
    retryable: boolean
  }[]
  serverTime: string
}

export function createSyncBatchRequest({
  clientId,
  operations,
  schemaVersion,
}: {
  clientId: string
  operations: OutboxOperation[]
  schemaVersion: number
}): SyncBatchRequest {
  return {
    protocol: 'flowpro-sync-v1',
    clientId,
    operations,
    schemaVersion,
  }
}

/**
 * Aggregate types the backend accepts on POST /api/v1/sync/batches.
 *
 * This mirrors `AllowedAggregates` in
 * apps/api/src/FlowPro.Application/Sync/SyncCommandHandler.cs and is the single
 * client-side source of truth for what may travel over the generic sync channel.
 *
 * `clock-event` is intentionally absent: attendance bookings are authoritative and
 * must be created through the advisory-locked, idempotent /api/v1/attendance/commands/*
 * endpoint, never the last-writer-wins sync batch. The server enforces and tests this
 * (SyncCommandHandlerTests.RejectsGenericClockEventWritesBecauseAttendanceApiIsAuthoritative),
 * so the client routes those operations with {@link shouldReplayThroughAttendanceApi}.
 */
export const BACKEND_SYNCABLE_AGGREGATES: ReadonlySet<
  OutboxOperation['aggregate']
> = new Set([
  'absence',
  'approval-workflow',
  'attachment',
  'attendance-policy',
  'attendance-type',
  'notification',
  'notification-preferences',
  'organization-catalog',
  'payroll-export',
  'request',
  'timesheet',
  'user',
])

/**
 * True when an outbox operation must be replayed through the authoritative
 * attendance command endpoint instead of the generic sync batch. Offline clock-in,
 * break, resume, and clock-out events are captured as `clock-event.create`
 * operations and can only be persisted by re-issuing the original attendance command.
 */
export function shouldReplayThroughAttendanceApi(
  operation: Pick<OutboxOperation, 'aggregate' | 'type'>
): boolean {
  return (
    operation.aggregate === 'clock-event' &&
    operation.type === 'clock-event.create'
  )
}

export const DEFAULT_CLOCK_EVENT_REPLAY_ERROR = 'Unable to sync clock event.'

/**
 * Result of replaying one offline clock event through the attendance API.
 *
 * `synced`   - the server persisted the booking.
 * `rejected` - the server declined for a terminal reason (for example an invalid
 *              state transition caused by another device). Retrying cannot help.
 */
export type ClockEventReplayOutcome =
  | { status: 'synced'; syncedAt: string }
  | { status: 'rejected'; message: string }

/**
 * How the outbox and the cached clock event must be updated after a replay
 * attempt. Kept pure so the payroll-critical state transitions can be tested
 * without a browser, IndexedDB, or a network.
 */
export type ClockEventReplayResolution = {
  operationStatus: Extract<
    OutboxOperation['status'],
    'synced' | 'cancelled' | 'failed'
  >
  eventSyncState?: 'failed'
  lastError?: string
  syncedAt?: string
  /** True when the drain loop must stop and retry on a later tick. */
  stopProcessing: boolean
}

/**
 * Resolves a completed replay attempt.
 *
 * A terminal rejection is cancelled rather than left pending: retrying an
 * operation the server has definitively refused would loop forever and hide the
 * failure. The cached booking is marked `failed` so it stays visible to the user
 * instead of silently disappearing.
 */
export function resolveClockEventReplayOutcome(
  outcome: ClockEventReplayOutcome
): ClockEventReplayResolution {
  if (outcome.status === 'rejected') {
    return {
      eventSyncState: 'failed',
      lastError: outcome.message,
      operationStatus: 'cancelled',
      stopProcessing: false,
    }
  }

  return {
    operationStatus: 'synced',
    stopProcessing: false,
    syncedAt: outcome.syncedAt,
  }
}

/**
 * Resolves a transient replay failure (server unavailable, offline, timeout).
 * The operation stays `failed` so it is picked up again on the next drain, and
 * the loop stops to avoid hammering an unreachable backend.
 */
export function resolveClockEventReplayFailure(
  error: unknown
): ClockEventReplayResolution {
  return {
    eventSyncState: 'failed',
    lastError:
      error instanceof Error ? error.message : DEFAULT_CLOCK_EVENT_REPLAY_ERROR,
    operationStatus: 'failed',
    stopProcessing: true,
  }
}

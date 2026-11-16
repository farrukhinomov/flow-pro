import { replayClockEvent } from '@/data/api/attendance.gateway'
import { listSyncChanges } from '@/data/api/sync.api'
import {
  listOutboxOperations,
  refreshSyncMeta,
  updateClockEvent,
  updateOutboxOperation,
} from '@/data/local/attendance.repo'
import { deleteFromStore, putInStore } from '@/data/local/db'
import { updateEmployeeRequest } from '@/data/local/requests.repo'
import {
  deleteWorkflowSideEffect,
  isApprovedAbsenceRecord,
  isEmployeeRequestRecord,
  isFlowProNotification,
  isPayrollExportRecord,
  saveWorkflowSideEffect,
} from '@/data/local/workflow-side-effects.repo'
import type {
  AttendancePolicyConfig,
  AttendanceStatusType,
  ClockEvent,
  MonthlyTimesheetApproval,
  OutboxOperation,
  SyncMeta,
} from '@/domain/attendance/types'
import type { NotificationPreferences } from '@/domain/notifications/types'
import type { OrganizationCatalogRecord } from '@/domain/organization/types'
import {
  resolveClockEventReplayFailure,
  resolveClockEventReplayOutcome,
  shouldReplayThroughAttendanceApi,
  type ClockEventReplayResolution,
} from '@/domain/sync/protocol'
import type { EmployeeUser } from '@/domain/users/types'
import {
  LocalSyncConflictError,
  sendOperationToLocalSyncClient,
} from './local-sync-client'

const SYNC_PULL_PAGE_SIZE = 100
const syncEvents = new EventTarget()
let autoSyncStarted = false
let syncInFlight = false

export function subscribeToAttendanceSync(callback: () => void) {
  syncEvents.addEventListener('sync-change', callback)

  return () => syncEvents.removeEventListener('sync-change', callback)
}

function emitSyncChange() {
  syncEvents.dispatchEvent(new Event('sync-change'))
}

function isClockEventPayload(payload: unknown): payload is ClockEvent {
  return (
    !!payload &&
    typeof payload === 'object' &&
    'id' in payload &&
    'type' in payload &&
    'occurredAt' in payload
  )
}

function isRecordWithId(payload: unknown): payload is { id: string } {
  return (
    !!payload &&
    typeof payload === 'object' &&
    'id' in payload &&
    typeof (payload as { id?: unknown }).id === 'string'
  )
}

function isUserPayload(payload: unknown): payload is EmployeeUser {
  return (
    isRecordWithId(payload) &&
    'username' in payload &&
    'email' in payload &&
    'role' in payload
  )
}

function isAttendanceTypePayload(
  payload: unknown
): payload is AttendanceStatusType {
  return (
    isRecordWithId(payload) &&
    'code' in payload &&
    'category' in payload &&
    'updatedAt' in payload
  )
}

function isAttendancePolicyPayload(
  payload: unknown
): payload is AttendancePolicyConfig {
  return (
    isRecordWithId(payload) &&
    'countryCode' in payload &&
    'approvalRules' in payload
  )
}

function isTimesheetPayload(
  payload: unknown
): payload is MonthlyTimesheetApproval {
  return (
    isRecordWithId(payload) &&
    'employeeId' in payload &&
    'periodMonth' in payload &&
    'status' in payload
  )
}

function isOrganizationCatalogPayload(
  payload: unknown
): payload is OrganizationCatalogRecord {
  return isRecordWithId(payload) && 'kind' in payload && 'status' in payload
}

function isNotificationPreferencesPayload(
  payload: unknown
): payload is NotificationPreferences {
  return (
    isRecordWithId(payload) &&
    'requestDecisions' in payload &&
    'syncFailures' in payload
  )
}

type ClientAggregateSyncEvent = {
  aggregate: OutboxOperation['aggregate']
  aggregateId: string
  operationType: OutboxOperation['type']
  deleted: boolean
  payload: unknown
  clientOperationId: string
  clientId: string
  serverVersion: string
  syncedAt: string
}

function isClientAggregateSyncEvent(
  payload: unknown
): payload is ClientAggregateSyncEvent {
  return (
    !!payload &&
    typeof payload === 'object' &&
    'aggregate' in payload &&
    'aggregateId' in payload &&
    'payload' in payload &&
    'deleted' in payload
  )
}

export async function notifyLocalDataChanged() {
  await refreshSyncMeta()
  emitSyncChange()
}

export async function pullServerSyncChanges() {
  let meta = await refreshSyncMeta({ isOnline: true })
  let cursor = meta.serverCursor ?? 0
  let pageCount = 0
  let lastSyncedAt: string | undefined

  while (pageCount < 10) {
    const page = await listSyncChanges({
      after: cursor,
      limit: SYNC_PULL_PAGE_SIZE,
    })

    for (const change of page.items) {
      await applyServerSyncChange(change.eventType, change.payload)
    }

    if (page.items.length > 0) {
      lastSyncedAt = new Date().toISOString()
    }

    if (page.nextCursor === cursor || page.items.length === 0) {
      break
    }

    cursor = page.nextCursor
    pageCount += 1
  }

  meta = await refreshSyncMeta({
    isOnline: true,
    lastError: undefined,
    lastSyncedAt: lastSyncedAt ?? meta.lastSyncedAt,
    serverCursor: cursor,
  })
  emitSyncChange()

  return meta
}

async function applyServerSyncChange(eventType: string, payload: unknown) {
  if (!eventType.startsWith('client-aggregate.')) return
  if (!isClientAggregateSyncEvent(payload)) return

  await applyAggregatePayload({
    aggregate: payload.aggregate,
    aggregateId: payload.aggregateId,
    deleted: payload.deleted,
    payload: payload.payload,
  })
}

export async function applyAggregatePayload({
  aggregate,
  aggregateId,
  deleted,
  payload,
}: {
  aggregate: OutboxOperation['aggregate']
  aggregateId: string
  deleted: boolean
  payload: unknown
}) {
  if (deleted) {
    await deleteAggregatePayload(aggregate, aggregateId)
    return
  }

  if (aggregate === 'clock-event' && isClockEventPayload(payload)) {
    await putInStore('clockEvents', { ...payload, syncState: 'synced' })
    return
  }

  if (aggregate === 'request' && isEmployeeRequestRecord(payload)) {
    await saveWorkflowSideEffect({ aggregate, aggregateId, payload })
    return
  }

  if (aggregate === 'absence' && isApprovedAbsenceRecord(payload)) {
    await saveWorkflowSideEffect({ aggregate, aggregateId, payload })
    return
  }

  if (aggregate === 'notification' && isFlowProNotification(payload)) {
    await saveWorkflowSideEffect({ aggregate, aggregateId, payload })
    return
  }

  if (aggregate === 'payroll-export' && isPayrollExportRecord(payload)) {
    await saveWorkflowSideEffect({ aggregate, aggregateId, payload })
    return
  }

  if (aggregate === 'user' && isUserPayload(payload)) {
    await putInStore('employeeUsers', payload)
    return
  }

  if (aggregate === 'timesheet' && isTimesheetPayload(payload)) {
    await putInStore('timesheetApprovals', payload)
    return
  }

  if (aggregate === 'attendance-policy' && isAttendancePolicyPayload(payload)) {
    await putInStore('attendancePolicyConfigs', payload)
    return
  }

  if (aggregate === 'attendance-type' && isAttendanceTypePayload(payload)) {
    await putInStore('attendanceTypes', payload)
    return
  }

  if (
    aggregate === 'organization-catalog' &&
    isOrganizationCatalogPayload(payload)
  ) {
    await putInStore('organizationCatalogs', payload)
    return
  }

  if (
    aggregate === 'notification-preferences' &&
    isNotificationPreferencesPayload(payload)
  ) {
    await putInStore('notificationPreferences', payload)
  }
}

async function deleteAggregatePayload(
  aggregate: OutboxOperation['aggregate'],
  aggregateId: string
) {
  if (aggregate === 'clock-event') {
    await deleteFromStore('clockEvents', aggregateId)
  } else if (aggregate === 'request') {
    await deleteWorkflowSideEffect('request', aggregateId)
  } else if (aggregate === 'absence') {
    await deleteWorkflowSideEffect('absence', aggregateId)
  } else if (aggregate === 'notification') {
    await deleteWorkflowSideEffect('notification', aggregateId)
  } else if (aggregate === 'payroll-export') {
    await deleteWorkflowSideEffect('payroll-export', aggregateId)
  } else if (aggregate === 'user') {
    await deleteFromStore('employeeUsers', aggregateId)
  } else if (aggregate === 'timesheet') {
    await deleteFromStore('timesheetApprovals', aggregateId)
  } else if (aggregate === 'attendance-policy') {
    await deleteFromStore('attendancePolicyConfigs', aggregateId)
  } else if (aggregate === 'attendance-type') {
    await deleteFromStore('attendanceTypes', aggregateId)
  } else if (aggregate === 'organization-catalog') {
    await deleteFromStore('organizationCatalogs', aggregateId)
  } else if (aggregate === 'notification-preferences') {
    await deleteFromStore('notificationPreferences', aggregateId)
  }
}

export async function syncAttendanceOutbox() {
  if (syncInFlight) return

  syncInFlight = true

  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await refreshSyncMeta({ isOnline: false })
      emitSyncChange()
      return
    }

    await refreshSyncMeta({ isOnline: true })
    emitSyncChange()

    try {
      await pullServerSyncChanges()
    } catch (error) {
      await refreshSyncMeta({
        isOnline: false,
        lastError:
          error instanceof Error
            ? error.message
            : 'Unable to pull server changes.',
      })
      emitSyncChange()
      return
    }

    const operations = (await listOutboxOperations()).filter(
      (operation) =>
        operation.status === 'pending' || operation.status === 'failed'
    )

    for (const operation of operations) {
      const syncingOperation: OutboxOperation = {
        ...operation,
        status: 'syncing',
        attemptCount: operation.attemptCount + 1,
        lastError: undefined,
      }

      await updateOutboxOperation(syncingOperation)
      emitSyncChange()

      if (shouldReplayThroughAttendanceApi(syncingOperation)) {
        let resolution: ClockEventReplayResolution

        try {
          resolution = resolveClockEventReplayOutcome(
            await replayClockEvent(syncingOperation)
          )
        } catch (error) {
          resolution = resolveClockEventReplayFailure(error)
        }

        await updateOutboxOperation({
          ...syncingOperation,
          status: resolution.operationStatus,
          lastError: resolution.lastError,
          ...(resolution.syncedAt ? { syncedAt: resolution.syncedAt } : {}),
        })

        if (
          resolution.eventSyncState &&
          isClockEventPayload(syncingOperation.payload)
        ) {
          await updateClockEvent({
            ...syncingOperation.payload,
            syncState: resolution.eventSyncState,
          })
        }

        await refreshSyncMeta({
          isOnline: resolution.stopProcessing
            ? typeof navigator === 'undefined'
              ? true
              : navigator.onLine
            : true,
          lastError: resolution.lastError,
          ...(resolution.syncedAt ? { lastSyncedAt: resolution.syncedAt } : {}),
        })
        emitSyncChange()

        if (resolution.stopProcessing) break

        continue
      }

      try {
        const ack = await sendOperationToLocalSyncClient(syncingOperation)
        const syncedOperation: OutboxOperation = {
          ...syncingOperation,
          status: 'synced',
          syncedAt: ack.syncedAt,
        }

        await updateOutboxOperation(syncedOperation)

        if (
          (syncedOperation.type === 'clock-event.create' ||
            syncedOperation.type === 'clock-event.update') &&
          isClockEventPayload(syncedOperation.payload)
        ) {
          await updateClockEvent({
            ...syncedOperation.payload,
            syncState: 'synced',
          })
        }

        if (
          syncedOperation.aggregate === 'request' &&
          isEmployeeRequestRecord(syncedOperation.payload)
        ) {
          await updateEmployeeRequest({
            ...syncedOperation.payload,
            syncState: 'synced',
          })
        }

        if (
          syncedOperation.aggregate === 'notification' &&
          isFlowProNotification(syncedOperation.payload)
        ) {
          await saveWorkflowSideEffect({
            aggregate: 'notification',
            aggregateId: syncedOperation.aggregateId,
            payload: syncedOperation.payload,
          })
        }

        await refreshSyncMeta({
          isOnline: true,
          lastSyncedAt: ack.syncedAt,
          lastError: undefined,
        })
        emitSyncChange()
      } catch (error) {
        if (error instanceof LocalSyncConflictError) {
          const conflictOperation: OutboxOperation = {
            ...syncingOperation,
            status: 'conflict',
            lastError: error.message,
            conflict: {
              message: error.message,
              remotePayload: error.remotePayload,
              serverVersion: error.serverVersion,
            },
          }

          await updateOutboxOperation(conflictOperation)
          await refreshSyncMeta({
            isOnline:
              typeof navigator === 'undefined' ? true : navigator.onLine,
            lastError: conflictOperation.lastError,
          })
          emitSyncChange()
          break
        }

        const failedOperation: OutboxOperation = {
          ...syncingOperation,
          status: 'failed',
          lastError:
            error instanceof Error
              ? error.message
              : 'Unable to sync operation.',
        }

        await updateOutboxOperation(failedOperation)

        if (
          (failedOperation.type === 'clock-event.create' ||
            failedOperation.type === 'clock-event.update') &&
          isClockEventPayload(failedOperation.payload)
        ) {
          await updateClockEvent({
            ...failedOperation.payload,
            syncState: 'failed',
          })
        }

        if (
          failedOperation.aggregate === 'request' &&
          isEmployeeRequestRecord(failedOperation.payload)
        ) {
          await updateEmployeeRequest({
            ...failedOperation.payload,
            syncState: 'failed',
          })
        }

        if (
          failedOperation.aggregate === 'notification' &&
          isFlowProNotification(failedOperation.payload)
        ) {
          await saveWorkflowSideEffect({
            aggregate: 'notification',
            aggregateId: failedOperation.aggregateId,
            payload: { ...failedOperation.payload, syncState: 'failed' },
          })
        }

        await refreshSyncMeta({
          isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
          lastError: failedOperation.lastError,
        })
        emitSyncChange()
        break
      }
    }

    try {
      await pullServerSyncChanges()
    } catch (error) {
      await refreshSyncMeta({
        isOnline: false,
        lastError:
          error instanceof Error
            ? error.message
            : 'Unable to pull server changes.',
      })
      emitSyncChange()
    }
  } finally {
    syncInFlight = false
  }
}

export function startAttendanceAutoSync() {
  if (autoSyncStarted) return

  autoSyncStarted = true

  const syncNow = () => {
    void syncAttendanceOutbox()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', syncNow)
    window.addEventListener('offline', () => {
      void refreshSyncMeta({ isOnline: false }).then(emitSyncChange)
    })
    window.setInterval(syncNow, 10_000)
  }

  syncNow()
}

export async function readCurrentSyncMeta(): Promise<SyncMeta> {
  return refreshSyncMeta()
}

export async function retryOutboxOperation(operationId: string) {
  const operation = (await listOutboxOperations()).find(
    (item) => item.id === operationId
  )

  if (!operation) throw new Error('Operation was not found.')

  await updateOutboxOperation({
    ...operation,
    status: 'pending',
    lastError: undefined,
    conflict: undefined,
  })
  await refreshSyncMeta()
  emitSyncChange()
  await syncAttendanceOutbox()
}

export async function cancelOutboxOperation(operationId: string) {
  const operation = (await listOutboxOperations()).find(
    (item) => item.id === operationId
  )

  if (!operation) throw new Error('Operation was not found.')

  await updateOutboxOperation({
    ...operation,
    status: 'cancelled',
    lastError: undefined,
  })
  await refreshSyncMeta()
  emitSyncChange()
}

export async function resolveOutboxConflict(
  operationId: string,
  resolution: 'local-wins' | 'remote-wins'
) {
  const operation = (await listOutboxOperations()).find(
    (item) => item.id === operationId
  )

  if (!operation) throw new Error('Operation was not found.')
  if (operation.status !== 'conflict') {
    throw new Error('Only conflicted operations can be resolved.')
  }

  if (resolution === 'remote-wins') {
    if (operation.conflict?.remotePayload) {
      await applyAggregatePayload({
        aggregate: operation.aggregate,
        aggregateId: operation.aggregateId,
        deleted: false,
        payload: operation.conflict.remotePayload,
      })
    }

    await updateOutboxOperation({
      ...operation,
      status: 'synced',
      lastError: undefined,
      syncedAt: new Date().toISOString(),
      conflict: {
        ...operation.conflict,
        message: operation.conflict?.message ?? 'Resolved with remote data.',
        resolution,
        resolvedAt: new Date().toISOString(),
      },
    })
    await refreshSyncMeta()
    emitSyncChange()
    return
  }

  await updateOutboxOperation({
    ...operation,
    status: 'pending',
    lastError: undefined,
    conflict: {
      ...operation.conflict,
      message: operation.conflict?.message ?? 'Resolved with local data.',
      resolution,
      resolvedAt: new Date().toISOString(),
    },
  })
  await refreshSyncMeta()
  emitSyncChange()
  await syncAttendanceOutbox()
}

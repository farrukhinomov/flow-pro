import { submitSyncBatch } from '@/data/api/sync.api'
import { LOCAL_DB_SCHEMA_VERSION } from '@/data/local/db'
import type { OutboxOperation } from '@/domain/attendance/types'
import { createSyncBatchRequest } from '@/domain/sync/protocol'

const SYNC_CLIENT_ID_KEY = 'flowpro.sync-client-id'

export type LocalSyncAck = {
  operationId: string
  serverVersion: string
  syncedAt: string
}

export class LocalSyncConflictError extends Error {
  remotePayload: unknown
  serverVersion: string

  constructor({
    message,
    remotePayload,
    serverVersion,
  }: {
    message: string
    remotePayload: unknown
    serverVersion: string
  }) {
    super(message)
    this.name = 'LocalSyncConflictError'
    this.remotePayload = remotePayload
    this.serverVersion = serverVersion
  }
}

export async function sendOperationToLocalSyncClient(
  operation: OutboxOperation
): Promise<LocalSyncAck> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Network is offline.')
  }

  const response = await submitSyncBatch(
    createSyncBatchRequest({
      clientId: getSyncClientId(),
      operations: [operation],
      schemaVersion: LOCAL_DB_SCHEMA_VERSION,
    })
  )
  const conflict = response.conflicts.find(
    (item) => item.operationId === operation.id
  )

  if (conflict) {
    throw new LocalSyncConflictError({
      message: conflict.message,
      remotePayload: conflict.remotePayload,
      serverVersion: conflict.serverVersion,
    })
  }

  const rejection = response.rejected.find(
    (item) => item.operationId === operation.id
  )

  if (rejection) {
    throw new Error(rejection.message)
  }

  const accepted = response.accepted.find(
    (item) => item.operationId === operation.id
  )

  if (!accepted) {
    throw new Error('Sync server did not acknowledge the operation.')
  }

  return accepted
}

export function getSyncClientId() {
  if (typeof window === 'undefined') return 'server-render'

  const current = window.localStorage.getItem(SYNC_CLIENT_ID_KEY)

  if (current) return current

  const next =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? `web-${crypto.randomUUID()}`
      : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`

  window.localStorage.setItem(SYNC_CLIENT_ID_KEY, next)

  return next
}

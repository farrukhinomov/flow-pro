import type { SyncState } from '@/domain/attendance/types'

/** Pure rules behind workspace-data.ts, kept apart so they test without a browser. */

const UNSENT_STATES: readonly SyncState[] = [
  'pending',
  'syncing',
  'failed',
  'conflict',
]

export function localDataOwner(tenantId: string, userId: string) {
  return `${tenantId}:${userId}`
}

/**
 * True when the stored data may belong to someone else. Data stored before ownership was
 * recorded counts as foreign too, because there is no way to tell whose it is.
 */
export function mustResetLocalData(
  previousOwner: string | null,
  owner: string,
  hasLocalData: boolean
) {
  if (previousOwner === owner) return false
  return previousOwner !== null || hasLocalData
}

export function isUnsent(state: SyncState) {
  return UNSENT_STATES.includes(state)
}

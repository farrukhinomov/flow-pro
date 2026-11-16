import { listOutboxOperations } from '@/data/local/attendance.repo'
import { resetFlowProLocalDatabase } from '@/data/local/db'
import { syncAttendanceOutbox } from '@/data/sync/sync-engine'
import { isUnsent, mustResetLocalData } from './local-data-owner'

/**
 * The browser keeps workspace data locally (IndexedDB and a few cached settings) so pages open
 * without waiting on the network. That data belongs to one membership: one person in one
 * workspace. It must never be shown to another person on the same browser, nor to the same person
 * after they switch workspace, and changes waiting to be sent must never be sent as someone else.
 */
const OWNER_KEY = 'flowpro.local-data-owner'
const WORKSPACE_CACHE_KEYS = [
  'flowpro.user-preferences',
  'flowpro.workspace-time-zone',
] as const

/** Makes the local data belong to `owner`, clearing whatever another membership left behind. */
export async function claimLocalData(owner: string) {
  const previousOwner = readOwner()

  if (previousOwner === owner) return

  // Without a recorded owner, any local database may hold another person's data.
  if (mustResetLocalData(previousOwner, owner, true)) {
    try {
      await clearLocalWorkspaceData()
    } catch {
      // Another tab still holds the database open. The owner stays unrecorded, so the next
      // page load tries again instead of adopting data that may not be this person's.
      return
    }
  }

  writeOwner(owner)
}

/**
 * Tries to send changes still waiting in the outbox. Returns how many could not be sent; those
 * would be lost, or worse, sent into the wrong workspace, if the local data were cleared now.
 */
export async function flushUnsentChanges() {
  await syncAttendanceOutbox()
  const operations = await listOutboxOperations()
  return operations.filter((operation) => isUnsent(operation.status)).length
}

export async function clearLocalWorkspaceData() {
  await resetFlowProLocalDatabase()

  try {
    WORKSPACE_CACHE_KEYS.forEach((key) => window.localStorage.removeItem(key))
    window.localStorage.removeItem(OWNER_KEY)
  } catch {
    // Blocked storage holds nothing to clear.
  }
}

function readOwner() {
  try {
    return window.localStorage.getItem(OWNER_KEY)
  } catch {
    return null
  }
}

function writeOwner(owner: string) {
  try {
    window.localStorage.setItem(OWNER_KEY, owner)
  } catch {
    // Without storage the data cannot be kept either, so there is nothing to protect.
  }
}

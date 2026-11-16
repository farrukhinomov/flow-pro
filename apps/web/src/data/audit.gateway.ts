import { cacheAuditEvents, listAuditEvents } from '@/data/local/audit.repo'
import {
  listAuditEventsWorkflow,
  shouldFallbackToLocalAudit,
} from './api/audit.api'

export async function listAuditEventsBackendFirst() {
  try {
    const events = await listAuditEventsWorkflow()
    await cacheAuditEvents(events)
    return events
  } catch (error) {
    if (!shouldFallbackToLocalAudit(error)) {
      throw error
    }

    return listAuditEvents()
  }
}

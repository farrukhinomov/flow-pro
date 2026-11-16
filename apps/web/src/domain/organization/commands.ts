import type { OutboxOperation } from '@/domain/attendance/types'
import type { OrganizationCatalogRecord } from './types'

function createId(prefix: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)

  return `${prefix}-${random}`
}

export function createOrganizationCatalogUpsertOperation(
  record: OrganizationCatalogRecord,
  now = new Date()
): OutboxOperation {
  return {
    id: createId('op'),
    type: 'organization-catalog.upsert',
    aggregate: 'organization-catalog',
    aggregateId: record.id,
    payload: record,
    clientCreatedAt:
      record.updatedAt instanceof Date
        ? record.updatedAt.toISOString()
        : now.toISOString(),
    status: 'pending',
    attemptCount: 0,
  }
}

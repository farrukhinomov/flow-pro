import { createOrganizationCatalogUpsertOperation } from '@/domain/organization/commands'
import type { OrganizationCatalogRecord } from '@/domain/organization/types'
import { tStatic } from '@/i18n/static'
import { enqueueOutbox } from './attendance.repo'
import { appendAuditEvent } from './audit.repo'
import { getAllFromStore, putInStore } from './db'

function toDate(value: unknown, fallback = new Date()) {
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const nextDate = new Date(value)
    if (!Number.isNaN(nextDate.getTime())) return nextDate
  }
  return fallback
}

function normalizeRecord<T extends OrganizationCatalogRecord>(record: T): T {
  const createdAt = toDate(record.createdAt)
  return {
    ...record,
    createdAt,
    updatedAt: toDate(record.updatedAt, createdAt),
  }
}

function getRecordLabel(record: OrganizationCatalogRecord) {
  if (record.kind === 'department' || record.kind === 'location') {
    return record.name
  }

  return record.kind === 'team' ? record.name : record.label
}

export async function listOrganizationCatalog() {
  const records = await getAllFromStore<OrganizationCatalogRecord>(
    'organizationCatalogs'
  )
  return records.map(normalizeRecord)
}

export async function saveOrganizationRecord(
  record: OrganizationCatalogRecord
) {
  const nextRecord = {
    ...record,
    updatedAt: new Date(),
  }
  const label = getRecordLabel(record)
  await putInStore('organizationCatalogs', nextRecord)
  await appendAuditEvent({
    id: `audit-org-${record.kind}-${record.id}-${nextRecord.updatedAt.getTime()}`,
    aggregate: 'attendance-policy',
    aggregateId: record.id,
    action: 'organization.catalog.saved',
    actorId: 'local-session',
    actorName: tStatic('usersUi.localSessionActor'),
    classification: 'system',
    createdAt: nextRecord.updatedAt.toISOString(),
    metadata: {
      kind: record.kind,
      status: record.status,
    },
    summary: tStatic('usersUi.organizationAudit.catalogUpdated', {
      label,
    }),
  })
  await enqueueOutbox(createOrganizationCatalogUpsertOperation(nextRecord))

  return nextRecord
}

export async function cacheOrganizationRecord(
  record: OrganizationCatalogRecord
) {
  await putInStore('organizationCatalogs', normalizeRecord(record))
}

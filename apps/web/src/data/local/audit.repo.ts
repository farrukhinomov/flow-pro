import { createAuditEvent, sealAuditEvents } from '@/domain/audit/audit'
import type { AuditEvent } from '@/domain/requests/types'
import { getAllFromStore, putInStore, putManyInStore } from './db'

function createId(prefix: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)

  return `${prefix}-${random}`
}

export async function appendAuditEvent(
  event: Omit<AuditEvent, 'hash' | 'immutable' | 'previousHash'>
) {
  const current = await getAllFromStore<AuditEvent>('auditEvents')
  const sealedEvents = current
    .filter((item) => item.hash)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  const previousHash = sealedEvents[sealedEvents.length - 1]?.hash
  const sealedEvent = createAuditEvent(event, previousHash)

  await putInStore('auditEvents', sealedEvent)

  return sealedEvent
}

export async function putSeedAuditEvents(events: AuditEvent[]) {
  const sealed = sealAuditEvents(events)

  await putManyInStore('auditEvents', sealed)
}

export async function cacheAuditEvents(events: AuditEvent[]) {
  const current = await getAllFromStore<AuditEvent>('auditEvents')
  const byId = new Map(current.map((event) => [event.id, event]))

  events.forEach((event) => byId.set(event.id, event))
  await putManyInStore(
    'auditEvents',
    sealAuditEvents(Array.from(byId.values()))
  )
}

export async function listAuditEvents() {
  const auditEvents = await getAllFromStore<AuditEvent>('auditEvents')

  return auditEvents.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export async function recordPrivacyAccessEvent({
  actorId,
  actorName,
  aggregateId,
  metadata,
  summary,
}: {
  actorId: string
  actorName: string
  aggregateId: string
  metadata?: Record<string, unknown>
  summary: string
}) {
  return appendAuditEvent({
    id: createId('audit-access'),
    aggregate: 'privacy-access',
    aggregateId,
    action: 'privacy.viewed',
    actorId,
    actorName,
    classification: 'personal-data',
    createdAt: new Date().toISOString(),
    metadata,
    summary,
  })
}

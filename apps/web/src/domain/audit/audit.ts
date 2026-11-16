import type { AuditEvent } from '@/domain/requests/types'

type AuditDraft = Omit<
  AuditEvent,
  'id' | 'createdAt' | 'hash' | 'immutable' | 'previousHash'
> & {
  createdAt?: string
  id?: string
}

function createId(prefix: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)

  return `${prefix}-${random}`
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
    .join(',')}}`
}

export function hashAuditPayload(value: unknown) {
  const input = canonicalize(value)
  let hash = 5381

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index)
  }

  return `sha256-dev-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function createAuditEvent(
  draft: AuditDraft,
  previousHash?: string
): AuditEvent {
  const event: AuditEvent = {
    ...draft,
    id: draft.id ?? createId('audit'),
    createdAt: draft.createdAt ?? new Date().toISOString(),
    immutable: true,
    previousHash,
  }

  return {
    ...event,
    hash: hashAuditPayload({
      action: event.action,
      actorId: event.actorId,
      aggregate: event.aggregate,
      aggregateId: event.aggregateId,
      classification: event.classification,
      createdAt: event.createdAt,
      metadata: event.metadata,
      previousHash: event.previousHash,
      summary: event.summary,
    }),
  }
}

export function sealAuditEvents(events: AuditEvent[]) {
  return events
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    .reduce<AuditEvent[]>((sealed, event) => {
      sealed.push(
        createAuditEvent(
          {
            ...event,
            id: event.id,
            createdAt: event.createdAt,
          },
          sealed[sealed.length - 1]?.hash
        )
      )

      return sealed
    }, [])
}

export function verifyAuditTrail(events: AuditEvent[]) {
  const ordered = [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  const issues = ordered.flatMap((event, index) => {
    const expectedPreviousHash = ordered[index - 1]?.hash
    const expectedHash = createAuditEvent(
      {
        ...event,
        id: event.id,
        createdAt: event.createdAt,
      },
      event.previousHash
    ).hash
    const eventIssues: string[] = []

    if (!event.immutable) {
      eventIssues.push(`${event.id} is missing immutable marker.`)
    }

    if (event.previousHash !== expectedPreviousHash) {
      eventIssues.push(`${event.id} has an invalid previous hash.`)
    }

    if (event.hash !== expectedHash) {
      eventIssues.push(`${event.id} hash does not match event payload.`)
    }

    return eventIssues
  })

  return {
    isValid: issues.length === 0,
    checkedEvents: ordered.length,
    issues,
  }
}

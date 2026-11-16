import { sealAuditEvents } from '@/domain/audit/audit'
import type { AuditEvent } from '@/domain/requests/types'
import { FlowProApiError, flowProApi } from './http-client'

type ApiAuditEvent = {
  id: string
  sequence: number
  actorUserId: string
  action: string
  aggregateType: string
  aggregateId: string
  detailsJson: string
  occurredAt: string
}

type ApiAuditEventPage = {
  items: ApiAuditEvent[]
  nextCursor?: string | null
}

export type ListAuditEventsWorkflowInput = {
  action?: string
  actorUserId?: string
  aggregateType?: string
  cursor?: string
  limit?: number
  search?: string
}

export type AuditEventPage = {
  items: AuditEvent[]
  nextCursor?: string
}

export async function listAuditEventsPageWorkflow(
  input: ListAuditEventsWorkflowInput = {}
): Promise<AuditEventPage> {
  const response = await flowProApi.get<ApiAuditEventPage>('/audit-events', {
    params: compactParams(input),
  })

  return {
    items: response.data.items.map(mapAuditEventFromApi),
    nextCursor: response.data.nextCursor ?? undefined,
  }
}

export async function listAuditEventsWorkflow(
  input: ListAuditEventsWorkflowInput = {}
) {
  const items: AuditEvent[] = []
  let cursor = input.cursor

  for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
    const page = await listAuditEventsPageWorkflow({
      ...input,
      cursor,
      limit: input.limit ?? 100,
    })

    items.push(...page.items)
    if (!page.nextCursor) break
    cursor = page.nextCursor
  }

  return sealAuditEvents(items)
}

export function shouldFallbackToLocalAudit(error: unknown) {
  return (
    !(error instanceof FlowProApiError) ||
    error.status === undefined ||
    error.status >= 500
  )
}

function mapAuditEventFromApi(event: ApiAuditEvent): AuditEvent {
  const details = parseDetails(event.detailsJson)

  return {
    id: event.id,
    action: event.action,
    actorId: event.actorUserId,
    actorName: event.actorUserId,
    aggregate: mapAggregate(event.aggregateType),
    aggregateId: event.aggregateId,
    classification: inferClassification(event.aggregateType),
    createdAt: event.occurredAt,
    immutable: true,
    metadata: {
      details,
      serverSequence: event.sequence,
    },
    summary: buildSummary(event, details),
  }
}

function buildSummary(event: ApiAuditEvent, details: unknown) {
  if (
    details &&
    typeof details === 'object' &&
    'summary' in details &&
    typeof (details as { summary?: unknown }).summary === 'string'
  ) {
    return (details as { summary: string }).summary
  }

  return `${event.action} on ${event.aggregateType} ${event.aggregateId}.`
}

function parseDetails(detailsJson: string) {
  try {
    return JSON.parse(detailsJson) as unknown
  } catch {
    return detailsJson
  }
}

function mapAggregate(aggregateType: string): AuditEvent['aggregate'] {
  const normalized = aggregateType.replace(/_/g, '-')

  if (
    [
      'attendance-policy',
      'attendance-type',
      'clock-event',
      'employment-contract',
      'notification',
      'organization-catalog',
      'payroll-export',
      'privacy-access',
      'request',
      'sync',
      'timesheet',
      'user',
    ].includes(normalized)
  ) {
    return normalized as AuditEvent['aggregate']
  }

  return 'system'
}

function inferClassification(
  aggregateType: string
): AuditEvent['classification'] {
  if (
    aggregateType.includes('request') ||
    aggregateType.includes('timesheet') ||
    aggregateType.includes('employment')
  ) {
    return 'personal-data'
  }

  return aggregateType.includes('attendance') ? 'sensitive' : 'system'
}

function compactParams(input: ListAuditEventsWorkflowInput) {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  )
}

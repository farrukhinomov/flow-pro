import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createAuditEvent, verifyAuditTrail } from './audit'

describe('audit trail', () => {
  it('seals events with a verifiable previous-hash chain', () => {
    const first = createAuditEvent({
      aggregate: 'user',
      aggregateId: 'usr-1',
      action: 'user.upserted',
      actorId: 'admin-1',
      actorName: 'Admin',
      classification: 'personal-data',
      createdAt: '2026-05-24T08:00:00.000Z',
      summary: 'User was updated.',
    })
    const second = createAuditEvent(
      {
        aggregate: 'privacy-access',
        aggregateId: 'global-audit-log',
        action: 'privacy.viewed',
        actorId: 'admin-1',
        actorName: 'Admin',
        classification: 'personal-data',
        createdAt: '2026-05-24T08:01:00.000Z',
        summary: 'Admin opened the audit log.',
      },
      first.hash
    )

    const result = verifyAuditTrail([second, first])

    assert.equal(result.isValid, true)
    assert.equal(result.checkedEvents, 2)
  })

  it('detects tampered audit payloads', () => {
    const event = createAuditEvent({
      aggregate: 'attendance-policy',
      aggregateId: 'default',
      action: 'attendance-policy.updated',
      actorId: 'admin-1',
      actorName: 'Admin',
      classification: 'personal-data',
      createdAt: '2026-05-24T08:00:00.000Z',
      summary: 'Policy was updated.',
    })

    const result = verifyAuditTrail([
      {
        ...event,
        summary: 'Policy was silently changed.',
      },
    ])

    assert.equal(result.isValid, false)
    assert.equal(result.issues.length > 0, true)
  })
})

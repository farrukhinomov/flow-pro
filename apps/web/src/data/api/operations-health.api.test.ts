import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mapOperationsHealth } from './operations-health.api'

describe('operations health api', () => {
  it('normalizes nullable backend fields for UI consumers', () => {
    const result = mapOperationsHealth({
      auditEventCount: 18,
      clientAggregateCount: 42,
      failedOutboxCount: 0,
      generatedAt: '2026-06-14T09:00:00.000Z',
      lastAuditEventAt: null,
      lastOutboxError: null,
      lastProcessedOutboxAt: null,
      lastProjectionUpdatedAt: '2026-06-14T08:58:00.000Z',
      oldestPendingOutboxAt: null,
      pendingOutboxCount: 0,
      status: 'ok',
    })

    assert.equal(result.lastAuditEventAt, undefined)
    assert.equal(result.lastOutboxError, undefined)
    assert.equal(result.lastProcessedOutboxAt, undefined)
    assert.equal(result.lastProjectionUpdatedAt, '2026-06-14T08:58:00.000Z')
  })
})

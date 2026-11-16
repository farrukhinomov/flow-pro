import type { OutboxOperation } from '@/domain/attendance/types'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createSyncBatchRequest } from './protocol'

const operation: OutboxOperation = {
  id: 'op-1',
  aggregate: 'request',
  aggregateId: 'req-1',
  attemptCount: 0,
  clientCreatedAt: '2026-05-24T08:00:00.000Z',
  payload: { id: 'req-1' },
  status: 'pending',
  type: 'request.submit',
}

describe('sync protocol', () => {
  it('creates a versioned backend sync batch contract', () => {
    const batch = createSyncBatchRequest({
      clientId: 'client-local',
      operations: [operation],
      schemaVersion: 6,
    })

    assert.equal(batch.protocol, 'flowpro-sync-v1')
    assert.equal(batch.operations[0]?.id, 'op-1')
    assert.equal(batch.schemaVersion, 6)
  })
})

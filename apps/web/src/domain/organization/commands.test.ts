import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createOrganizationCatalogUpsertOperation } from './commands'
import type { RoleProfile, TeamCatalog, WorkPatternCatalog } from './types'

describe('organization commands', () => {
  it('creates a catalog upsert operation with the record updated timestamp', () => {
    const record: TeamCatalog = {
      id: 'team-product',
      kind: 'team',
      name: 'Product',
      managerId: 'user-manager',
      status: 'active',
      createdAt: new Date('2026-06-01T08:00:00.000Z'),
      updatedAt: new Date('2026-06-10T09:00:00.000Z'),
    }

    const operation = createOrganizationCatalogUpsertOperation(
      record,
      new Date('2026-06-10T10:00:00.000Z')
    )

    assert.match(operation.id, /^op-/)
    assert.equal(operation.type, 'organization-catalog.upsert')
    assert.equal(operation.aggregate, 'organization-catalog')
    assert.equal(operation.aggregateId, record.id)
    assert.equal(operation.payload, record)
    assert.equal(operation.clientCreatedAt, record.updatedAt.toISOString())
    assert.equal(operation.status, 'pending')
    assert.equal(operation.attemptCount, 0)
  })

  it('supports all organization catalog record variants', () => {
    const base = {
      status: 'active' as const,
      createdAt: new Date('2026-06-01T08:00:00.000Z'),
      updatedAt: new Date('2026-06-10T09:00:00.000Z'),
    }
    const records: Array<RoleProfile | TeamCatalog | WorkPatternCatalog> = [
      {
        ...base,
        id: 'role-hr-admin',
        kind: 'role-profile',
        label: 'HR Admin',
        baseRole: 'hr',
      },
      {
        ...base,
        id: 'team-operations',
        kind: 'team',
        name: 'Operations',
      },
      {
        ...base,
        id: 'pattern-full-time',
        kind: 'work-pattern',
        label: 'Full time',
        weeklyHours: 40,
      },
    ]

    const operations = records.map((record) =>
      createOrganizationCatalogUpsertOperation(record)
    )

    assert.deepEqual(
      operations.map((operation) => operation.aggregateId),
      records.map((record) => record.id)
    )
    assert.ok(
      operations.every(
        (operation) =>
          operation.aggregate === 'organization-catalog' &&
          operation.type === 'organization-catalog.upsert'
      )
    )
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { makeManagerDelegationId } from './delegations'

describe('makeManagerDelegationId', () => {
  it('normalizes team names into stable ids', () => {
    assert.equal(
      makeManagerDelegationId('mgr-1', 'Customer Success Team'),
      'delegation-mgr-1-customer-success-team'
    )
  })

  it('keeps manager id and lowercases team slug', () => {
    assert.equal(
      makeManagerDelegationId('manager-X', 'SALES'),
      'delegation-manager-X-sales'
    )
  })
})

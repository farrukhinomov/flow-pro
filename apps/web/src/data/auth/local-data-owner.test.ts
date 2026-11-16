import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isUnsent,
  localDataOwner,
  mustResetLocalData,
} from './local-data-owner'

describe('local workspace data ownership', () => {
  const ada = localDataOwner('tenant-a', 'user-1')

  it('keeps data that belongs to the same membership', () => {
    assert.equal(mustResetLocalData(ada, ada, true), false)
  })

  it('clears data of another person or another workspace', () => {
    assert.equal(
      mustResetLocalData(localDataOwner('tenant-a', 'user-2'), ada, true),
      true
    )
    assert.equal(
      mustResetLocalData(localDataOwner('tenant-b', 'user-1'), ada, false),
      true
    )
  })

  it('clears data stored before ownership was recorded', () => {
    assert.equal(mustResetLocalData(null, ada, true), true)
    assert.equal(mustResetLocalData(null, ada, false), false)
  })

  it('treats everything not yet accepted by the server as unsent', () => {
    assert.ok(isUnsent('pending'))
    assert.ok(isUnsent('failed'))
    assert.ok(isUnsent('conflict'))
    assert.ok(!isUnsent('synced'))
    assert.ok(!isUnsent('cancelled'))
  })
})

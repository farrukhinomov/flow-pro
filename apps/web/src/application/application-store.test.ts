import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApplicationStore } from './application-store'
import { runBackendFirstWrite } from './backend-first-workflow'

describe('application store read-through', () => {
  it('emits local data first and then remote data', async () => {
    const store = new ApplicationStore()
    const snapshots: string[] = []

    const result = await store.readThrough({
      local: async () => 'cached',
      onSnapshot: ({ data, source }) => snapshots.push(`${source}:${data}`),
      remote: async () => 'fresh',
    })

    assert.equal(result, 'fresh')
    assert.deepEqual(snapshots, ['local:cached', 'remote:fresh'])
  })

  it('returns cached data when remote refresh fails', async () => {
    const store = new ApplicationStore()
    const snapshots: string[] = []

    const result = await store.readThrough({
      local: async () => 'cached',
      onSnapshot: ({ data, source }) => snapshots.push(`${source}:${data}`),
      remote: async () => {
        throw new Error('API unavailable')
      },
    })

    assert.equal(result, 'cached')
    assert.deepEqual(snapshots, ['local:cached'])
  })

  it('throws when both local and remote reads fail', async () => {
    const store = new ApplicationStore()

    await assert.rejects(
      () =>
        store.readThrough({
          local: async () => {
            throw new Error('IndexedDB unavailable')
          },
          remote: async () => {
            throw new Error('API unavailable')
          },
        }),
      /API unavailable/
    )
  })
})

describe('backend-first write helper', () => {
  it('uses backend result and runs backend success effects', async () => {
    const effects: string[] = []

    const result = await runBackendFirstWrite({
      backend: async () => 'server-result',
      fallback: async () => {
        effects.push('fallback')
        return 'local-result'
      },
      onBackendSuccess: async (value) => {
        effects.push(`backend:${value}`)
      },
      onLocalSuccess: async (value) => {
        effects.push(`local:${value}`)
      },
      shouldFallback: () => true,
    })

    assert.equal(result, 'server-result')
    assert.deepEqual(effects, ['backend:server-result'])
  })

  it('falls back only when the fallback predicate allows it', async () => {
    const effects: string[] = []

    const result = await runBackendFirstWrite({
      backend: async () => {
        throw new Error('network')
      },
      fallback: async () => 'local-result',
      onBackendSuccess: async () => {
        effects.push('backend')
      },
      onLocalSuccess: async (value) => {
        effects.push(`local:${value}`)
      },
      shouldFallback: () => true,
    })

    assert.equal(result, 'local-result')
    assert.deepEqual(effects, ['local:local-result'])
  })

  it('does not fallback for validation or authorization failures', async () => {
    await assert.rejects(
      () =>
        runBackendFirstWrite({
          backend: async () => {
            throw new Error('forbidden')
          },
          fallback: async () => 'local-result',
          shouldFallback: () => false,
        }),
      /forbidden/
    )
  })
})

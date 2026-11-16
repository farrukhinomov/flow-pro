import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { optionalSource } from './optional-source'

describe('optionalSource', () => {
  it('passes a successful source through', async () => {
    assert.deepEqual(
      await optionalSource(Promise.resolve([1, 2]), [], 'numbers'),
      [1, 2]
    )
  })

  it('uses the fallback value when the source fails', async () => {
    assert.deepEqual(
      await optionalSource(Promise.reject(new Error('403')), [], 'people'),
      []
    )
  })

  it('loads the fallback lazily, only when the source fails', async () => {
    let loaded = 0
    const fromCache = async () => {
      loaded += 1
      return ['cached']
    }

    assert.deepEqual(
      await optionalSource(Promise.resolve(['live']), fromCache, 'people'),
      ['live']
    )
    assert.equal(loaded, 0)
    assert.deepEqual(
      await optionalSource(
        Promise.reject(new Error('offline')),
        fromCache,
        'people'
      ),
      ['cached']
    )
    assert.equal(loaded, 1)
  })

  it('keeps the other sources of a combined load when one fails', async () => {
    const [types, people] = await Promise.all([
      optionalSource(Promise.resolve(['Vacation']), [], 'absence types'),
      optionalSource(Promise.reject(new Error('403')), [], 'people'),
    ])

    assert.deepEqual(types, ['Vacation'])
    assert.deepEqual(people, [])
  })
})

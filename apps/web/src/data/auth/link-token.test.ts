import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readLinkToken } from './link-token'

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ-_01234'

describe('readLinkToken', () => {
  it('reads a token from the fragment', () => {
    assert.equal(readLinkToken(`#token=${TOKEN}`), TOKEN)
  })

  for (const hash of [
    '',
    '#',
    '#token=',
    '#token=short',
    `#other=${TOKEN}`,
    `#token=${TOKEN}!`,
  ]) {
    it(`returns null for ${JSON.stringify(hash)}`, () => {
      assert.equal(readLinkToken(hash), null)
    })
  }
})

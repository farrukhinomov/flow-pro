import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { describeUserAgent } from './user-agent'

describe('describeUserAgent', () => {
  const cases: [string, string | null, string | null][] = [
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      'Chrome',
      'Windows',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0',
      'Edge',
      'Windows',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15',
      'Safari',
      'macOS',
    ],
    [
      'Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0',
      'Firefox',
      'Linux',
    ],
    [
      'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
      'Chrome',
      'Android',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0 Mobile/15E148 Safari/604.1',
      'Chrome',
      'iOS',
    ],
    ['curl/8.10.1', null, null],
  ]

  for (const [userAgent, browser, os] of cases) {
    it(`reads ${browser ?? 'nothing'} on ${os ?? 'nothing'}`, () => {
      assert.deepEqual(describeUserAgent(userAgent), { browser, os })
    })
  }

  it('handles a missing user agent', () => {
    assert.deepEqual(describeUserAgent(null), { browser: null, os: null })
  })
})

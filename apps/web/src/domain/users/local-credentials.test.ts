import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  listLocalUserCredentials,
  upsertLocalUserCredential,
} from './local-credentials'

const LOCAL_CREDENTIALS_KEY = 'flowpro.local-user-credentials'

function installLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
      },
    },
  })
}

describe('local user credentials', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it('returns an empty list outside the browser', () => {
    delete (globalThis as { window?: unknown }).window

    assert.deepEqual(listLocalUserCredentials(), [])
  })

  it('filters invalid stored credential records', () => {
    installLocalStorage({
      [LOCAL_CREDENTIALS_KEY]: JSON.stringify([
        {
          email: 'hannah.fischer@flowpro.local',
          password: 'FlowPro!2026',
          userId: 'usr-hannah-fischer',
        },
        { email: 'broken' },
        null,
      ]),
    })

    assert.deepEqual(listLocalUserCredentials(), [
      {
        email: 'hannah.fischer@flowpro.local',
        password: 'FlowPro!2026',
        userId: 'usr-hannah-fischer',
      },
    ])
  })

  it('upserts credentials by user id and normalizes email', () => {
    installLocalStorage()

    upsertLocalUserCredential({
      email: ' Hannah.Fischer@FlowPro.Local ',
      password: 'first',
      userId: 'usr-hannah-fischer',
    })
    upsertLocalUserCredential({
      email: 'hannah.fischer@flowpro.local',
      password: 'second',
      userId: 'usr-hannah-fischer',
    })

    assert.deepEqual(listLocalUserCredentials(), [
      {
        email: 'hannah.fischer@flowpro.local',
        password: 'second',
        userId: 'usr-hannah-fischer',
      },
    ])
  })

  it('does not create a credential without a password', () => {
    installLocalStorage()

    upsertLocalUserCredential({
      email: 'new.user@flowpro.local',
      userId: 'usr-new-user',
    })

    assert.deepEqual(listLocalUserCredentials(), [])
  })
})

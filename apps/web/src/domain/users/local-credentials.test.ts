import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  findLocalUserCredential,
  listLocalUserCredentials,
  upsertLocalUserCredential,
} from './local-credentials'

const LOCAL_CREDENTIALS_KEY = 'flowpro.local-user-credentials.v2'
const LEGACY_CREDENTIALS_KEY = 'flowpro.local-user-credentials'

function installLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        removeItem: (key: string) => {
          store.delete(key)
        },
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
      },
    },
  })

  return store
}

describe('local user credentials', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it('returns an empty list outside the browser', () => {
    delete (globalThis as { window?: unknown }).window

    assert.deepEqual(listLocalUserCredentials(), [])
  })

  it('never stores the password itself', async () => {
    const store = installLocalStorage()

    await upsertLocalUserCredential({
      email: ' Hannah.Fischer@FlowPro.Local ',
      password: 'FlowPro!2026',
      userId: 'usr-hannah-fischer',
    })

    const stored = store.get(LOCAL_CREDENTIALS_KEY) ?? ''
    assert.ok(stored.length > 0)
    assert.ok(!stored.includes('FlowPro!2026'))
    const [credential] = listLocalUserCredentials()
    assert.equal(credential.email, 'hannah.fischer@flowpro.local')
    assert.equal(credential.userId, 'usr-hannah-fischer')
    assert.ok(!('password' in credential))
  })

  it('finds the user only with the right password', async () => {
    installLocalStorage()
    await upsertLocalUserCredential({
      email: 'hannah.fischer@flowpro.local',
      password: 'first password',
      userId: 'usr-hannah-fischer',
    })

    const found = await findLocalUserCredential(
      'Hannah.Fischer@flowpro.local',
      'first password'
    )
    assert.equal(found?.userId, 'usr-hannah-fischer')
    assert.equal(
      await findLocalUserCredential(
        'hannah.fischer@flowpro.local',
        'wrong password'
      ),
      undefined
    )
    assert.equal(
      await findLocalUserCredential('someone@flowpro.local', 'first password'),
      undefined
    )
  })

  it('replaces the password, and keeps it when only the email changes', async () => {
    installLocalStorage()
    await upsertLocalUserCredential({
      email: 'hannah.fischer@flowpro.local',
      password: 'first password',
      userId: 'usr-hannah-fischer',
    })
    await upsertLocalUserCredential({
      email: 'hannah.fischer@flowpro.local',
      password: 'second password',
      userId: 'usr-hannah-fischer',
    })
    await upsertLocalUserCredential({
      email: 'hannah@flowpro.local',
      userId: 'usr-hannah-fischer',
    })

    assert.equal(listLocalUserCredentials().length, 1)
    assert.equal(
      await findLocalUserCredential('hannah@flowpro.local', 'first password'),
      undefined
    )
    assert.equal(
      (await findLocalUserCredential('hannah@flowpro.local', 'second password'))
        ?.userId,
      'usr-hannah-fischer'
    )
  })

  it('does not create a credential without a password', async () => {
    installLocalStorage()

    await upsertLocalUserCredential({
      email: 'new.user@flowpro.local',
      userId: 'usr-new-user',
    })

    assert.deepEqual(listLocalUserCredentials(), [])
  })

  it('removes plain-text passwords left by earlier builds', () => {
    const store = installLocalStorage({
      [LEGACY_CREDENTIALS_KEY]: JSON.stringify([
        {
          email: 'hannah.fischer@flowpro.local',
          password: 'FlowPro!2026',
          userId: 'usr-hannah-fischer',
        },
      ]),
    })

    assert.deepEqual(listLocalUserCredentials(), [])
    assert.equal(store.has(LEGACY_CREDENTIALS_KEY), false)
  })
})

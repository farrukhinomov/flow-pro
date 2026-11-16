import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { getFlowProEnv } from './runtime-env'

type RuntimeConfigHost = {
  __FLOWPRO_CONFIG__?: Record<string, string | undefined>
}

const host = globalThis as RuntimeConfigHost

describe('runtime environment', () => {
  afterEach(() => {
    delete host.__FLOWPRO_CONFIG__
  })

  it('returns an object when no runtime configuration is present', () => {
    assert.equal(typeof getFlowProEnv(), 'object')
  })

  it('exposes values set by the runtime configuration', () => {
    host.__FLOWPRO_CONFIG__ = { VITE_FLOWPRO_AUTH_MODE: 'session' }

    assert.equal(getFlowProEnv().VITE_FLOWPRO_AUTH_MODE, 'session')
  })

  it('ignores empty runtime values', () => {
    const before = getFlowProEnv().VITE_FLOWPRO_API_BASE_URL
    host.__FLOWPRO_CONFIG__ = { VITE_FLOWPRO_API_BASE_URL: '' }

    assert.equal(getFlowProEnv().VITE_FLOWPRO_API_BASE_URL, before)
  })
})

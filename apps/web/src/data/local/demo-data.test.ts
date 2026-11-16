import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

type Env = Record<string, string | undefined>

/**
 * Mirrors `isLocalCredentialAuthEnabled` composed with `isDemoDataEnabled`.
 *
 * The real pair reads `import.meta.env`, which is replaced at build time and so
 * cannot be varied from a Node test. The condition itself is what matters here:
 * which deployments may write fictional people into the local database.
 */
function demoDataEnabled(env: Env) {
  return (
    env.VITE_FLOWPRO_AUTH_MODE === 'local' ||
    env.VITE_FLOWPRO_DEV_HEADER_AUTH === 'true'
  )
}

describe('demo data gate', () => {
  it('is on for the local credential experience', () => {
    assert.equal(demoDataEnabled({ VITE_FLOWPRO_AUTH_MODE: 'local' }), true)
  })

  it('is on for the development header auth used by e2e', () => {
    assert.equal(
      demoDataEnabled({ VITE_FLOWPRO_DEV_HEADER_AUTH: 'true' }),
      true
    )
  })

  it('is off for a public session deployment', () => {
    // The case that matters. A real tenant must never be shown invented
    // colleagues, invented requests, or sealed audit events it did not produce.
    assert.equal(
      demoDataEnabled({
        VITE_FLOWPRO_AUTH_MODE: 'session',
        VITE_FLOWPRO_DEV_HEADER_AUTH: 'false',
      }),
      false
    )
  })

  it('is off when nothing is configured', () => {
    assert.equal(demoDataEnabled({}), false)
  })

  it('is off for a development build pointed at a real backend', () => {
    // Gating on DEV alone would have seeded here, which is why the gate uses
    // the local-credential signal instead.
    assert.equal(demoDataEnabled({ VITE_FLOWPRO_AUTH_MODE: 'session' }), false)
  })
})

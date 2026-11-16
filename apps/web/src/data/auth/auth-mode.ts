import { getFlowProEnv } from '@/config/runtime-env'

/**
 * How the browser signs in.
 *
 * - `session`: email and password against the FlowPro API, which keeps the session in an
 *   HttpOnly cookie. The browser never holds a token. This is the mode for every real deployment.
 * - `local`: the in-browser simulation with seeded demo users, for working on the UI without a
 *   backend. Optionally forwards development headers to an API running in Development.
 */
export type AuthMode = 'session' | 'local'

export function getAuthMode(): AuthMode {
  const env = getFlowProEnv()

  if (
    env.VITE_FLOWPRO_AUTH_MODE === 'local' ||
    env.VITE_FLOWPRO_DEV_HEADER_AUTH === 'true'
  ) {
    return 'local'
  }

  return 'session'
}

export function isSessionAuthEnabled() {
  return getAuthMode() === 'session'
}

export function isLocalCredentialAuthEnabled() {
  return getAuthMode() === 'local'
}

/** Self-registration can be turned off, for example on the public demo. */
export function isRegistrationEnabled() {
  return (
    isSessionAuthEnabled() &&
    getFlowProEnv().VITE_FLOWPRO_REGISTRATION_ENABLED !== 'false'
  )
}

/**
 * The public demo: the sign-in page offers the shared logins. The API decides what they are and
 * refuses changes that would lock other visitors out.
 */
export function isDemoMode() {
  return (
    isSessionAuthEnabled() && getFlowProEnv().VITE_FLOWPRO_DEMO_MODE === 'true'
  )
}

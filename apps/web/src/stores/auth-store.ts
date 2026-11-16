import { isSessionAuthEnabled } from '@/data/auth/auth-mode'
import type { UserRole } from '@/domain/users/types'
import { create } from 'zustand'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'

const LEGACY_ACCESS_TOKEN = 'thisisjustarandomstring'
const ACCESS_TOKEN = 'flowpro.local-auth-token'
const AUTH_USER = 'flowpro.local-auth-user'
const AUTH_MAX_AGE_SECONDS = 60 * 60 * 8
const AUTH_TTL_MS = AUTH_MAX_AGE_SECONDS * 1000

/**
 * The signed-in user as the interface shows them.
 *
 * In session mode this is a display cache only. The server session in its HttpOnly cookie is what
 * grants access; when it ends, the next API call answers 401 and the cache is cleared.
 */
export interface AuthUser {
  accountNo: string
  email: string
  name: string
  role: UserRole[]
  source?: 'local-dev' | 'session'
  team?: string
  exp: number
}

interface AuthState {
  auth: {
    user: AuthUser | null
    setUser: (user: AuthUser | null) => void
    /** Local simulation only: identifies the simulated user for development headers. */
    accessToken: string
    setAccessToken: (accessToken: string) => void
    resetAccessToken: () => void
    reset: () => void
  }
}

function encodeAuthUser(user: AuthUser) {
  return btoa(encodeURIComponent(JSON.stringify(user)))
}

function decodeAuthUser(value: string | undefined) {
  if (!value) return null

  try {
    const parsed = JSON.parse(decodeURIComponent(atob(value)))

    if (
      typeof parsed?.accountNo !== 'string' ||
      typeof parsed?.email !== 'string' ||
      typeof parsed?.name !== 'string' ||
      !Array.isArray(parsed?.role) ||
      typeof parsed?.exp !== 'number'
    ) {
      return null
    }

    return parsed as AuthUser
  } catch {
    return null
  }
}

function readInitialAuthUser() {
  const user = decodeAuthUser(getCookie(AUTH_USER))
  if (!user || user.exp <= Date.now()) return null

  return user
}

function readInitialLocalToken(hasUser: boolean) {
  const cookieState = getCookie(ACCESS_TOKEN) ?? getCookie(LEGACY_ACCESS_TOKEN)
  if (!hasUser || !cookieState) return ''

  try {
    const token: unknown = JSON.parse(cookieState)
    return typeof token === 'string' && token.startsWith('local-session-')
      ? token
      : ''
  } catch {
    return ''
  }
}

function clearStoredAuth() {
  removeCookie(ACCESS_TOKEN)
  removeCookie(AUTH_USER)
  removeCookie(LEGACY_ACCESS_TOKEN)
}

export const useAuthStore = create<AuthState>()((set) => {
  const initUser = readInitialAuthUser()

  return {
    auth: {
      user: initUser,
      setUser: (user) =>
        set((state) => {
          if (user) {
            setCookie(AUTH_USER, encodeAuthUser(user), AUTH_MAX_AGE_SECONDS)
          } else {
            removeCookie(AUTH_USER)
          }

          return { ...state, auth: { ...state.auth, user } }
        }),
      accessToken: readInitialLocalToken(!!initUser),
      setAccessToken: (accessToken) =>
        set((state) => {
          if (accessToken) {
            setCookie(
              ACCESS_TOKEN,
              JSON.stringify(accessToken),
              AUTH_MAX_AGE_SECONDS
            )
          } else {
            removeCookie(ACCESS_TOKEN)
          }

          return { ...state, auth: { ...state.auth, accessToken } }
        }),
      resetAccessToken: () =>
        set((state) => {
          removeCookie(ACCESS_TOKEN)
          removeCookie(LEGACY_ACCESS_TOKEN)
          return { ...state, auth: { ...state.auth, accessToken: '' } }
        }),
      reset: () =>
        set((state) => {
          clearStoredAuth()
          return {
            ...state,
            auth: { ...state.auth, user: null, accessToken: '' },
          }
        }),
    },
  }
})

export function createLocalAuthUser({
  email,
  name,
  role,
  team,
  userId,
}: {
  email: string
  name: string
  role: UserRole
  team?: string
  userId: string
}): AuthUser {
  return {
    accountNo: userId,
    email,
    exp: Date.now() + AUTH_TTL_MS,
    name,
    role: [role],
    source: 'local-dev',
    team,
  }
}

export function createSessionAuthUser({
  email,
  name,
  roles,
  userId,
}: {
  email: string
  name: string
  roles: UserRole[]
  userId: string
}): AuthUser {
  return {
    accountNo: userId,
    email,
    exp: Date.now() + AUTH_TTL_MS,
    name,
    role: roles,
    source: 'session',
  }
}

export function hasActiveAuthSession() {
  const { accessToken, user } = useAuthStore.getState().auth

  if (!user || user.exp <= Date.now()) return false

  return isSessionAuthEnabled() || !!accessToken
}

export function getSafeRedirectPath(redirectTo?: string) {
  if (
    !redirectTo ||
    !redirectTo.startsWith('/') ||
    redirectTo.startsWith('//') ||
    redirectTo === '/sign-in'
  ) {
    return '/'
  }

  return redirectTo
}

import axios, { AxiosError } from 'axios'
import { getFlowProEnv } from '@/config/runtime-env'
import { isSessionAuthEnabled } from '@/data/auth/auth-mode'
import { useAuthStore } from '@/stores/auth-store'

type ProblemDetails = {
  detail?: string
  code?: string
  extensions?: {
    code?: string
  }
}

export class FlowProApiError extends Error {
  code: string
  status?: number

  constructor(message: string, code = 'api.request-failed', status?: number) {
    super(message)
    this.name = 'FlowProApiError'
    this.code = code
    this.status = status
  }
}

type FlowProEnv = {
  VITE_FLOWPRO_API_BASE_URL?: string
  VITE_FLOWPRO_DEV_HEADER_AUTH?: string
  VITE_FLOWPRO_DEV_TENANT_ID?: string
  VITE_FLOWPRO_DEV_USER_ID?: string
  VITE_FLOWPRO_DEV_WORKER_USER_ID?: string
}

const flowProEnv: FlowProEnv = getFlowProEnv()
const apiBaseUrl = flowProEnv?.VITE_FLOWPRO_API_BASE_URL
const devHeaderAuthEnabled = flowProEnv?.VITE_FLOWPRO_DEV_HEADER_AUTH === 'true'
const developmentUserIds: Record<string, string | undefined> = {
  'usr-marta-lindgren': flowProEnv?.VITE_FLOWPRO_DEV_USER_ID,
  'usr-hannah-fischer':
    flowProEnv?.VITE_FLOWPRO_DEV_WORKER_USER_ID ??
    '01975fa8-7590-7000-8000-000000000010',
}

export const flowProApi = axios.create({
  baseURL: apiBaseUrl ?? '/api/v1',
  timeout: 15_000,
  // The session is an HttpOnly cookie. Same-origin requests send it anyway; this also sends it
  // when the API runs on another local port during development.
  withCredentials: true,
})

flowProApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().auth.accessToken

  if (token.startsWith('local-session-') && devHeaderAuthEnabled) {
    const tenantId = flowProEnv?.VITE_FLOWPRO_DEV_TENANT_ID
    const userId = resolveDevelopmentUserId(token)

    if (tenantId && userId) {
      config.headers['X-FlowPro-Tenant-Id'] = tenantId
      config.headers['X-FlowPro-User-Id'] = userId
    }
  }

  return config
})

function resolveDevelopmentUserId(token: string) {
  const localUserId = token.slice('local-session-'.length)

  return developmentUserIds[localUserId] ?? flowProEnv?.VITE_FLOWPRO_DEV_USER_ID
}

flowProApi.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (!axios.isAxiosError<ProblemDetails>(error)) {
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && endsSignedInSession(error)) {
      returnToSignIn()
    }

    return Promise.reject(toFlowProApiError(error))
  }
)

/**
 * A 401 from an ordinary endpoint while the interface believes someone is signed in means the
 * server session ended (signed out elsewhere, revoked, or expired). Account endpoints are excluded:
 * there a 401 is an expected answer the caller handles itself.
 */
function endsSignedInSession(error: AxiosError) {
  const url = error.config?.url ?? ''

  return (
    isSessionAuthEnabled() &&
    !!useAuthStore.getState().auth.user &&
    !url.startsWith('/auth/') &&
    !url.startsWith('/onboarding/workspace')
  )
}

function returnToSignIn() {
  useAuthStore.getState().auth.reset()

  if (typeof window === 'undefined') return

  const redirect = `${window.location.pathname}${window.location.search}`
  window.location.assign(`/sign-in?redirect=${encodeURIComponent(redirect)}`)
}

function toFlowProApiError(error: AxiosError<ProblemDetails>) {
  const problem = error.response?.data
  const code =
    problem?.code ?? problem?.extensions?.code ?? 'api.request-failed'
  const message =
    problem?.detail ??
    (error.code === AxiosError.ERR_NETWORK
      ? 'FlowPro API is unavailable.'
      : error.message)

  return new FlowProApiError(message, code, error.response?.status)
}

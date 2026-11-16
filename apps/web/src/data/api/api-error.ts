import { DEFAULT_LOCALE } from '@/i18n'
import { hasMessage } from '@/i18n/resolve'
import { FlowProApiError } from './http-client'

type Translate = (key: string, vars?: Record<string, string | number>) => string

/**
 * Message key namespace mirroring the backend problem-details `code`.
 *
 * The backend documents `code` as the stable, machine-readable contract and
 * tells clients to branch on it rather than on English message text. Only the
 * Today screen actually did, so every other feature fell back to generic copy
 * and users saw "Something went wrong" for errors the server had already
 * explained precisely.
 *
 * Keys mirror the code structure exactly (`attendance.geo.invalid` ->
 * `apiErrors.attendance.geo.invalid`), so adding a backend code means adding
 * one message, with no lookup table to keep in sync.
 */
const API_ERROR_NAMESPACE = 'apiErrors'

/**
 * Codes that describe an infrastructure failure rather than something the user
 * did. They are mapped to a generic message on purpose: surfacing
 * "concurrency.conflict" or a raw 500 detail helps nobody.
 */
const OPAQUE_CODES = new Set([
  'api.request-failed',
  'concurrency.conflict',
  'server.unexpected',
])

export function isFlowProApiError(error: unknown): error is FlowProApiError {
  return error instanceof FlowProApiError
}

/**
 * Per-status message keys. `badRequest` and `conflict` have no app-wide default
 * on purpose: a generic "some details are invalid" is worse copy than the
 * caller's own "Could not save the employee", so those fall through to the
 * fallback unless a feature supplies something more specific.
 */
export type StatusMessageKeys = {
  badRequest?: string
  conflict?: string
  forbidden?: string
  unauthorized?: string
  unavailable?: string
}

const DEFAULT_STATUS_KEYS: StatusMessageKeys = {
  forbidden: 'errorsUi.forbidden',
  unauthorized: 'errorsUi.sessionExpired',
  unavailable: 'apiErrors.status.unavailable',
}

/**
 * Resolves the best available message for a failed API call.
 *
 * Resolution order:
 * 1. A translated message for the backend error code.
 * 2. Session expiry, permission, and server-unavailable, which are always more
 *    actionable than "could not save X" because the fix is different.
 * 3. Caller-supplied 400/409 copy, when the feature has better wording.
 * 4. The caller's feature-specific fallback key.
 * 5. The error's own message, for non-API errors thrown locally.
 *
 * Existence is checked against the default locale because English is the
 * complete message set; a code translated there but not yet in German still
 * resolves, falling back to English through `t`.
 */
export function resolveApiErrorMessage(
  error: unknown,
  t: Translate,
  fallbackKey: string,
  statusKeys: StatusMessageKeys = {}
) {
  if (isFlowProApiError(error)) {
    if (!OPAQUE_CODES.has(error.code)) {
      const key = `${API_ERROR_NAMESPACE}.${error.code}`

      if (hasMessage(DEFAULT_LOCALE, key)) return t(key)
    }

    const keys = { ...DEFAULT_STATUS_KEYS, ...statusKeys }
    const { status } = error
    const statusKey =
      status === 401
        ? keys.unauthorized
        : status === 403
          ? keys.forbidden
          : status === undefined || status >= 500
            ? keys.unavailable
            : status === 400
              ? keys.badRequest
              : status === 409
                ? keys.conflict
                : undefined

    if (statusKey && hasMessage(DEFAULT_LOCALE, statusKey)) return t(statusKey)
  }

  if (hasMessage(DEFAULT_LOCALE, fallbackKey)) return t(fallbackKey)

  return error instanceof Error ? error.message : t(fallbackKey)
}

/**
 * True when the failure is the user's session expiring rather than a problem
 * with what they submitted, so callers can redirect instead of showing a toast.
 */
export function isAuthenticationError(error: unknown) {
  return isFlowProApiError(error) && error.status === 401
}

/** True when the user is authenticated but lacks the required permission. */
export function isPermissionError(error: unknown) {
  return isFlowProApiError(error) && error.status === 403
}

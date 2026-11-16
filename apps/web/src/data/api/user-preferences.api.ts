import {
  normalizeUserPreferences,
  type UserPreferences,
} from '@/domain/users/preferences'
import { FlowProApiError, flowProApi } from './http-client'

type ApiUserPreferences = Partial<UserPreferences> & {
  ownerUserId?: string
  updatedAt?: string
}

export async function getUserPreferencesWorkflow(): Promise<UserPreferences> {
  const response = await flowProApi.get<ApiUserPreferences>('/me/preferences')

  return normalizeUserPreferences(response.data)
}

export async function saveUserPreferencesWorkflow(
  preferences: UserPreferences
): Promise<UserPreferences> {
  const response = await flowProApi.put<ApiUserPreferences>(
    '/me/preferences',
    preferences
  )

  return normalizeUserPreferences(response.data)
}

/**
 * Preferences are cosmetic, so an unreachable API falls back to the cached copy
 * rather than blocking the settings page. A 4xx is not a fallback case: it means
 * the request itself was rejected and the user needs to see why.
 */
export function shouldFallbackToLocalPreferences(error: unknown) {
  return (
    !(error instanceof FlowProApiError) ||
    error.status === undefined ||
    error.status >= 500
  )
}

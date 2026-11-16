import {
  normalizeUserPreferences,
  type UserPreferences,
} from '@/domain/users/preferences'
import {
  getUserPreferencesWorkflow,
  saveUserPreferencesWorkflow,
  shouldFallbackToLocalPreferences,
} from './api/user-preferences.api'

/**
 * Local mirror of the server-owned preferences.
 *
 * The backend is authoritative; this exists so the first paint after a reload
 * uses the user's real choices instead of flashing the defaults, and so the
 * settings page still renders while offline. It is deliberately a plain
 * `localStorage` key rather than an IndexedDB store: it is a single small
 * record, it is not part of any sync outbox, and losing it costs nothing.
 */
const CACHE_KEY = 'flowpro.user-preferences'

export function readCachedUserPreferences(): UserPreferences | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = window.localStorage.getItem(CACHE_KEY)

    return stored
      ? normalizeUserPreferences(JSON.parse(stored) as Partial<UserPreferences>)
      : null
  } catch {
    return null
  }
}

function cacheUserPreferences(preferences: UserPreferences) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(preferences))
  } catch {
    // A full or blocked storage quota must not fail the surrounding save.
  }
}

/**
 * One read per page load, shared by every settings page.
 *
 * Preferences change at most a handful of times in an account's life, and three
 * settings pages read them. Fetching per page added concurrent requests that
 * competed with the authenticated layout's blocking onboarding-state guard, and
 * intermittently pushed a route's first paint past its budget.
 *
 * Mirrors the caching the onboarding guard already uses for the same reason.
 */
let inFlight: Promise<UserPreferences> | null = null

export function resetUserPreferencesCache() {
  inFlight = null
}

export async function getUserPreferencesBackendFirst(): Promise<UserPreferences> {
  inFlight ??= (async () => {
    try {
      const preferences = await getUserPreferencesWorkflow()

      cacheUserPreferences(preferences)

      return preferences
    } catch (error) {
      if (!shouldFallbackToLocalPreferences(error)) {
        // A rejected read must not be cached, or the failure would stick for
        // the rest of the session.
        inFlight = null
        throw error
      }
    }

    return readCachedUserPreferences() ?? normalizeUserPreferences(null)
  })()

  return inFlight
}

/**
 * Saves to the backend and mirrors the accepted result locally.
 *
 * Failures propagate: unlike a read, a silent local-only write would tell the
 * user their preference was saved when the next device will not see it.
 */
export async function saveUserPreferencesBackendFirst(
  preferences: UserPreferences
): Promise<UserPreferences> {
  const saved = await saveUserPreferencesWorkflow(preferences)

  cacheUserPreferences(saved)
  // Keep the shared read in step with what the server accepted, so another
  // settings page opened afterwards shows the saved values.
  inFlight = Promise.resolve(saved)

  return saved
}

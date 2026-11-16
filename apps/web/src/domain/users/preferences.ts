/**
 * Interface preferences for one user.
 *
 * Mirrors `UserPreferencesDto` on the server. These were browser-local until
 * the backend gained a `me/preferences` workflow, so the shape deliberately
 * covers everything the Account and Display settings forms own.
 */
export type UserPreferences = {
  defaultWorkLocation: WorkLocationPreference
  densityCompact: boolean
  fullWidthPages: boolean
  locale: string
  showPolicyHints: boolean
  showSyncStatus: boolean
  timeZoneId: string
  weekStart: WeekStart
}

export type WeekStart = 'monday' | 'sunday'
export type WorkLocationPreference = 'office' | 'home-office'

export const WEEK_STARTS: readonly WeekStart[] = ['monday', 'sunday']
export const WORK_LOCATION_PREFERENCES: readonly WorkLocationPreference[] = [
  'office',
  'home-office',
]

/** Matches the server-side defaults so an unsaved account renders identically. */
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  defaultWorkLocation: 'office',
  densityCompact: false,
  fullWidthPages: true,
  locale: 'en',
  showPolicyHints: true,
  showSyncStatus: true,
  timeZoneId: 'Europe/Berlin',
  weekStart: 'monday',
}

export function isWeekStart(value: string): value is WeekStart {
  return (WEEK_STARTS as readonly string[]).includes(value)
}

export function isWorkLocationPreference(
  value: string
): value is WorkLocationPreference {
  return (WORK_LOCATION_PREFERENCES as readonly string[]).includes(value)
}

/**
 * Coerces an arbitrary payload into valid preferences.
 *
 * Applied to both the API response and any locally cached value, so a stale
 * cache written by an older build cannot put an unusable enum into a select.
 */
export function normalizeUserPreferences(
  value: Partial<UserPreferences> | null | undefined
): UserPreferences {
  if (!value) return DEFAULT_USER_PREFERENCES

  return {
    defaultWorkLocation:
      typeof value.defaultWorkLocation === 'string' &&
      isWorkLocationPreference(value.defaultWorkLocation)
        ? value.defaultWorkLocation
        : DEFAULT_USER_PREFERENCES.defaultWorkLocation,
    densityCompact:
      value.densityCompact ?? DEFAULT_USER_PREFERENCES.densityCompact,
    fullWidthPages:
      value.fullWidthPages ?? DEFAULT_USER_PREFERENCES.fullWidthPages,
    locale: value.locale?.trim() || DEFAULT_USER_PREFERENCES.locale,
    showPolicyHints:
      value.showPolicyHints ?? DEFAULT_USER_PREFERENCES.showPolicyHints,
    showSyncStatus:
      value.showSyncStatus ?? DEFAULT_USER_PREFERENCES.showSyncStatus,
    timeZoneId: value.timeZoneId?.trim() || DEFAULT_USER_PREFERENCES.timeZoneId,
    weekStart:
      typeof value.weekStart === 'string' && isWeekStart(value.weekStart)
        ? value.weekStart
        : DEFAULT_USER_PREFERENCES.weekStart,
  }
}

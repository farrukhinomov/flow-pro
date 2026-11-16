import { useCallback, useEffect, useState } from 'react'
import { resolveApiErrorMessage } from '@/data/api/api-error'
import {
  getUserPreferencesBackendFirst,
  readCachedUserPreferences,
  saveUserPreferencesBackendFirst,
} from '@/data/user-preferences.gateway'
import {
  normalizeUserPreferences,
  type UserPreferences,
} from '@/domain/users/preferences'
import { useI18n } from '@/i18n'
import { toast } from 'sonner'

type UserPreferencesState = {
  isLoading: boolean
  isSaving: boolean
  preferences: UserPreferences
  save: (next: UserPreferences) => Promise<boolean>
}

/**
 * Reads and writes the signed-in user's preferences.
 *
 * Starts from the local mirror so the form paints with the user's real choices
 * rather than the defaults, then refreshes from the backend.
 */
export function useUserPreferences(): UserPreferencesState {
  const { t } = useI18n()
  const [preferences, setPreferences] = useState<UserPreferences>(
    () => readCachedUserPreferences() ?? normalizeUserPreferences(null)
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    void getUserPreferencesBackendFirst()
      .then((next) => {
        if (!cancelled) setPreferences(next)
      })
      .catch(() => {
        // The cached value is already rendered; a failed refresh should not
        // replace it with defaults or block the page.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const save = useCallback(
    async (next: UserPreferences) => {
      setIsSaving(true)

      try {
        setPreferences(await saveUserPreferencesBackendFirst(next))
        return true
      } catch (error) {
        toast.error(
          resolveApiErrorMessage(error, t, 'settingsUi.preferencesSaveFailed')
        )
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [t]
  )

  return { isLoading, isSaving, preferences, save }
}

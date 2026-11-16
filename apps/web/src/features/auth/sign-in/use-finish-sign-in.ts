import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { loadWorkspaceSession } from '@/data/auth/account-session'
import { useI18n } from '@/i18n'
import { toast } from 'sonner'
import { getSafeRedirectPath, useAuthStore } from '@/stores/auth-store'
import { ACCEPT_INVITATION_PATH } from '@/features/auth/invitation'

/**
 * Loads the workspace session after the server issued a session cookie, then goes where the
 * person was headed. Shared by the password form and the two-step code page.
 */
export function useFinishSignIn(redirectTo: string | undefined) {
  const navigate = useNavigate()
  const { t } = useI18n()

  return useCallback(
    async (fallbackName: string) => {
      const state = await loadWorkspaceSession()

      if (state === 'no-workspace') {
        // Someone signing in to accept an invitation has no workspace yet, and is about to
        // join one instead of creating their own.
        const target = getSafeRedirectPath(redirectTo)
        await navigate({
          to:
            target === ACCEPT_INVITATION_PATH
              ? ACCEPT_INVITATION_PATH
              : '/claim-workspace',
          replace: true,
        })
        return
      }

      const name = useAuthStore.getState().auth.user?.name ?? fallbackName
      toast.success(t('auth.welcomeBack', { name }))
      await navigate({ to: getSafeRedirectPath(redirectTo), replace: true })
    },
    [navigate, redirectTo, t]
  )
}

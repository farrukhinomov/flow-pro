import { createFileRoute, redirect } from '@tanstack/react-router'
import { loadWorkspaceSession } from '@/data/auth/account-session'
import { isSessionAuthEnabled } from '@/data/auth/auth-mode'
import { hasActiveAuthSession, useAuthStore } from '@/stores/auth-store'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { useOnboardingRedirect } from '@/features/onboarding/use-onboarding-redirect'

export const Route = createFileRoute('/_authenticated')({
  /**
   * The session check is an access boundary and must resolve before anything
   * renders. With a cached user it needs no network: the server still decides
   * on every request, and a 401 sends the user back here. Without one, a server
   * session may still exist (the display cache expires sooner), so it is asked
   * once before falling back to sign-in. The onboarding check lives in
   * {@link useOnboardingRedirect} so pages do not wait on it before painting.
   */
  beforeLoad: async ({ location }) => {
    if (
      !hasActiveAuthSession() &&
      isSessionAuthEnabled() &&
      (await loadWorkspaceSession().catch(() => 'no-workspace')) === 'ready'
    ) {
      return
    }

    if (!hasActiveAuthSession()) {
      useAuthStore.getState().auth.reset()

      throw redirect({
        to: '/sign-in',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: AuthenticatedRoute,
})

function AuthenticatedRoute() {
  useOnboardingRedirect()

  return <AuthenticatedLayout />
}

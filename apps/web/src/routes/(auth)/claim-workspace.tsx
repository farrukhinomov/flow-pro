import { createFileRoute, redirect } from '@tanstack/react-router'
import { isSessionAuthEnabled } from '@/data/auth/auth-mode'
import { hasActiveAuthSession } from '@/stores/auth-store'
import { ClaimWorkspace } from '@/features/onboarding/claim-workspace'

export const Route = createFileRoute('/(auth)/claim-workspace')({
  beforeLoad: () => {
    // A resolved session already has a workspace.
    if (hasActiveAuthSession()) {
      throw redirect({ to: '/' })
    }

    // Claiming needs a server session. Whether one exists is only known to the server, so the page
    // asks it and offers sign-in when there is none.
    if (!isSessionAuthEnabled()) {
      throw redirect({ to: '/sign-in', search: { redirect: undefined } })
    }
  },
  component: ClaimWorkspace,
})

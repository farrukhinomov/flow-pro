import { createFileRoute, redirect } from '@tanstack/react-router'
import { isSessionAuthEnabled } from '@/data/auth/auth-mode'
import { AcceptInvitation } from '@/features/auth/invitation'

export const Route = createFileRoute('/(auth)/accept-invitation')({
  beforeLoad: () => {
    if (isSessionAuthEnabled()) return

    throw redirect({ to: '/sign-in' })
  },
  component: AcceptInvitation,
})

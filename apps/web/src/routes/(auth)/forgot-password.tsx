import { createFileRoute, redirect } from '@tanstack/react-router'
import { isSessionAuthEnabled } from '@/data/auth/auth-mode'
import { ForgotPassword } from '@/features/auth/account-recovery'

export const Route = createFileRoute('/(auth)/forgot-password')({
  beforeLoad: () => {
    // The local simulation has no server to send mail from.
    if (isSessionAuthEnabled()) return

    throw redirect({ to: '/sign-in' })
  },
  component: ForgotPassword,
})

import { createFileRoute, redirect } from '@tanstack/react-router'
import { isSessionAuthEnabled } from '@/data/auth/auth-mode'
import { VerifyEmail } from '@/features/auth/account-recovery'

export const Route = createFileRoute('/(auth)/verify-email')({
  beforeLoad: () => {
    if (isSessionAuthEnabled()) return

    throw redirect({ to: '/sign-in' })
  },
  component: VerifyEmail,
})

import { createFileRoute, redirect } from '@tanstack/react-router'
import { isSessionAuthEnabled } from '@/data/auth/auth-mode'
import { ResetPassword } from '@/features/auth/account-recovery'

export const Route = createFileRoute('/(auth)/reset-password')({
  beforeLoad: () => {
    if (isSessionAuthEnabled()) return

    throw redirect({ to: '/sign-in' })
  },
  component: ResetPassword,
})

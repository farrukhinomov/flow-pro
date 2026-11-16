import { createFileRoute, redirect } from '@tanstack/react-router'
import { hasActiveAuthSession } from '@/stores/auth-store'
import { SignUp } from '@/features/auth/sign-up'

export const Route = createFileRoute('/(auth)/sign-up')({
  beforeLoad: () => {
    // Someone already signed in does not need to create a second workspace.
    if (!hasActiveAuthSession()) return

    throw redirect({ to: '/' })
  },
  component: SignUp,
})

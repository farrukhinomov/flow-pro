import { z } from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSafeRedirectPath, hasActiveAuthSession } from '@/stores/auth-store'
import { TwoFactorSignIn } from '@/features/auth/two-factor'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/two-factor')({
  beforeLoad: ({ search }) => {
    if (!hasActiveAuthSession()) return

    throw redirect({
      to: getSafeRedirectPath(search.redirect),
    })
  },
  component: TwoFactorSignIn,
  validateSearch: searchSchema,
})

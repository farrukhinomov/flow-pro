import { z } from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSafeRedirectPath, hasActiveAuthSession } from '@/stores/auth-store'
import { SignIn } from '@/features/auth/sign-in'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/sign-in')({
  beforeLoad: ({ search }) => {
    if (!hasActiveAuthSession()) return

    throw redirect({
      to: getSafeRedirectPath(search.redirect),
    })
  },
  component: SignIn,
  validateSearch: searchSchema,
})

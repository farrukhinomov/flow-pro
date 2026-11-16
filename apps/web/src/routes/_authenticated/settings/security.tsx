import { createFileRoute, redirect } from '@tanstack/react-router'
import { isSessionAuthEnabled } from '@/data/auth/auth-mode'
import { RouteError } from '@/features/errors/route-error'
import { SettingsSecurity } from '@/features/settings/security'

export const Route = createFileRoute('/_authenticated/settings/security')({
  beforeLoad: () => {
    // The local simulation has no server-side account to secure.
    if (isSessionAuthEnabled()) return

    throw redirect({ to: '/settings/account' })
  },
  component: SettingsSecurity,
  errorComponent: RouteError,
})

import { createFileRoute } from '@tanstack/react-router'
import { RouteError } from '@/features/errors/route-error'
import { SettingsAccount } from '@/features/settings/account'

export const Route = createFileRoute('/_authenticated/settings/account')({
  component: SettingsAccount,
  errorComponent: RouteError,
})

import { createFileRoute } from '@tanstack/react-router'
import { RouteError } from '@/features/errors/route-error'
import { SettingsProfile } from '@/features/settings/profile'

export const Route = createFileRoute('/_authenticated/settings/')({
  component: SettingsProfile,
  errorComponent: RouteError,
})

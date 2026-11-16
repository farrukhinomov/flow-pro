import { createFileRoute } from '@tanstack/react-router'
import { RouteError } from '@/features/errors/route-error'
import { SettingsNotifications } from '@/features/settings/notifications'

export const Route = createFileRoute('/_authenticated/settings/notifications')({
  component: SettingsNotifications,
  errorComponent: RouteError,
})

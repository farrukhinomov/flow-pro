import { createFileRoute } from '@tanstack/react-router'
import { RouteError } from '@/features/errors/route-error'
import { SettingsSyncHealth } from '@/features/settings/sync-health'

export const Route = createFileRoute('/_authenticated/settings/sync-health')({
  component: SettingsSyncHealth,
  errorComponent: RouteError,
})

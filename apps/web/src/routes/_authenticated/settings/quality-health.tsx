import { createFileRoute } from '@tanstack/react-router'
import { RouteError } from '@/features/errors/route-error'
import { SettingsQualityHealth } from '@/features/settings/quality-health'

export const Route = createFileRoute('/_authenticated/settings/quality-health')(
  {
    component: SettingsQualityHealth,
    errorComponent: RouteError,
  }
)

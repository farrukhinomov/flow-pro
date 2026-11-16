import { createFileRoute } from '@tanstack/react-router'
import { RouteError } from '@/features/errors/route-error'
import { SettingsAppearance } from '@/features/settings/appearance'

export const Route = createFileRoute('/_authenticated/settings/appearance')({
  component: SettingsAppearance,
  errorComponent: RouteError,
})

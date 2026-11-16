import { createFileRoute } from '@tanstack/react-router'
import { RouteError } from '@/features/errors/route-error'
import { SettingsAttendance } from '@/features/settings/attendance'

export const Route = createFileRoute('/_authenticated/settings/attendance')({
  component: SettingsAttendance,
  errorComponent: RouteError,
})

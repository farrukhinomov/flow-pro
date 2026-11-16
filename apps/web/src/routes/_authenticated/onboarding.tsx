import { createFileRoute } from '@tanstack/react-router'
import { RouteError } from '@/features/errors/route-error'
import { OnboardingWizard } from '@/features/onboarding'

export const Route = createFileRoute('/_authenticated/onboarding')({
  component: OnboardingWizard,
  errorComponent: RouteError,
})

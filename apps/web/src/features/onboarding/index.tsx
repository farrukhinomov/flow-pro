import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { attendanceWorkflow } from '@/application/attendance-workflow'
import {
  onboardingWorkflow,
  type CompanyStepInput,
  type InviteOutcome,
  type InviteRow,
} from '@/application/onboarding-workflow'
import type { ApiOnboardingStepKey } from '@/contracts/api'
import { useI18n } from '@/i18n'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { LoadingState } from '@/components/flowpro/empty-state'
import { Main } from '@/components/layout/main'
import { useSession } from '@/features/access/session-provider'
import { AbsencesStep } from './components/absences-step'
import { CompanyStep } from './components/company-step'
import { FirstClockInStep } from './components/first-clock-in-step'
import { TeamStep } from './components/team-step'
import { WizardProgress } from './components/wizard-progress'
import { useOnboarding } from './hooks/use-onboarding'
import { resetOnboardingGuard } from './onboarding-guard'
import {
  getActiveStep,
  getDefaultAnnualLeaveDays,
  getProgressPercent,
  getWizardSteps,
  isOnboardingComplete,
  type OnboardingWizardStep,
} from './onboarding-view-model'

export function OnboardingWizard() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { session } = useSession()
  const {
    error,
    isLoading,
    isSaving,
    runStep,
    setState,
    state,
    workspaceName,
  } = useOnboarding()
  const [requestedStep, setRequestedStep] =
    useState<ApiOnboardingStepKey | null>(null)
  const [countryCode, setCountryCode] = useState<string | null>('DE')
  const [failedInvites, setFailedInvites] = useState<InviteOutcome[]>([])

  const activeStep = getActiveStep(state, requestedStep)
  const steps = useMemo(
    () => getWizardSteps(state, activeStep),
    [activeStep, state]
  )
  const percent = getProgressPercent(state)
  const activeStepMeta = steps.find((step) => step.key === activeStep)

  const finish = useCallback(async () => {
    const result = await runStep(() => onboardingWorkflow.completeOnboarding())

    if (!result) return

    setState(result)
    // The route guard caches setup state per session; drop it so Today is reachable immediately.
    resetOnboardingGuard()
    toast.success(t('onboardingUi.finishedToast'))
    await navigate({ replace: true, to: '/' })
  }, [navigate, runStep, setState, t])

  const advanceFrom = useCallback(
    (step: ApiOnboardingStepKey) => {
      const nextIndex = steps.findIndex((item) => item.key === step) + 1
      const nextStep = steps[nextIndex]

      setRequestedStep(nextStep ? nextStep.key : null)
    },
    [steps]
  )

  const handleCompany = useCallback(
    async (input: CompanyStepInput) => {
      const result = await runStep(() =>
        onboardingWorkflow.saveCompanyProfile(input)
      )

      if (!result) return

      setCountryCode(input.countryCode ?? null)
      setState(result.onboarding)
      advanceFrom('company')
    },
    [advanceFrom, runStep, setState]
  )

  const handleInvites = useCallback(
    async (rows: InviteRow[]) => {
      const result = await runStep(() =>
        onboardingWorkflow.sendTeamInvites(rows)
      )

      if (!result) return

      setFailedInvites(result.failed)
      setState(result.onboarding)

      if (result.invited.length > 0) {
        toast.success(
          t('onboardingUi.team.invitedToast', {
            count: String(result.invited.length),
          })
        )
      }

      if (result.failed.length === 0) advanceFrom('team')
    },
    [advanceFrom, runStep, setState, t]
  )

  const handleAbsences = useCallback(
    async (annualLeaveDays: number) => {
      const result = await runStep(() =>
        onboardingWorkflow.saveAbsencePolicy(annualLeaveDays)
      )

      if (!result) return

      setState(result)
      advanceFrom('absences')
    },
    [advanceFrom, runStep, setState]
  )

  const handleSkip = useCallback(
    async (step: ApiOnboardingStepKey) => {
      const result = await runStep(() =>
        onboardingWorkflow.resolveStep(step, { skipped: true })
      )

      if (!result) return

      setState(result)
      advanceFrom(step)
    },
    [advanceFrom, runStep, setState]
  )

  const handleFirstClockIn = useCallback(async () => {
    const result = await runStep(async () => {
      await attendanceWorkflow.clock({
        day: new Date(),
        employeeId: session.employeeId,
        location: 'office',
        type: 'clock-in',
      })

      return onboardingWorkflow.resolveStep('first-clock-in')
    })

    if (!result) return

    setState(result)
    await finish()
  }, [finish, runStep, session.employeeId, setState])

  const handleSelectStep = useCallback((step: OnboardingWizardStep) => {
    setRequestedStep(step.key)
  }, [])

  if (isLoading) {
    return (
      <Main className='max-w-3xl'>
        <LoadingState title={t('onboardingUi.loading')} />
      </Main>
    )
  }

  if (isOnboardingComplete(state) && !requestedStep) {
    return (
      <Main className='max-w-3xl space-y-4'>
        <Card>
          <CardHeader>
            <CardTitle>{t('onboardingUi.alreadyDoneTitle')}</CardTitle>
            <CardDescription>
              {t('onboardingUi.alreadyDoneDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void navigate({ to: '/' })}>
              {t('onboardingUi.goToToday')}
            </Button>
          </CardContent>
        </Card>
      </Main>
    )
  }

  return (
    <Main className='max-w-3xl space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold tracking-tight'>
          {t('onboardingUi.title')}
        </h1>
        <p className='mt-1 text-sm text-muted-foreground'>
          {t('onboardingUi.subtitle')}
        </p>
      </div>

      <WizardProgress
        percent={percent}
        steps={steps}
        onSelectStep={handleSelectStep}
      />

      {error && (
        <Alert variant='destructive'>
          <AlertTriangle className='h-4 w-4' />
          <AlertTitle>{t('onboardingUi.errors.saveFailedTitle')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {activeStepMeta ? t(activeStepMeta.titleKey) : ''}
          </CardTitle>
          <CardDescription>
            {activeStepMeta ? t(activeStepMeta.descriptionKey) : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeStep === 'company' && (
            <CompanyStep
              defaultCompanyName={workspaceName}
              isSaving={isSaving}
              onSubmit={(input) => void handleCompany(input)}
            />
          )}

          {activeStep === 'team' && (
            <TeamStep
              failedInvites={failedInvites}
              isSaving={isSaving}
              onInvite={(rows) => void handleInvites(rows)}
              onSkip={() => void handleSkip('team')}
            />
          )}

          {activeStep === 'absences' && (
            <AbsencesStep
              defaultAnnualLeaveDays={getDefaultAnnualLeaveDays(countryCode)}
              isSaving={isSaving}
              onSkip={() => void handleSkip('absences')}
              onSubmit={(days) => void handleAbsences(days)}
            />
          )}

          {activeStep === 'first-clock-in' && (
            <FirstClockInStep
              isSaving={isSaving}
              onClockIn={() => void handleFirstClockIn()}
              onSkip={() => void finish()}
            />
          )}
        </CardContent>
      </Card>

      <div className='flex justify-end'>
        <Button
          disabled={isSaving}
          variant='ghost'
          onClick={() => void finish()}
        >
          {t('onboardingUi.finishLater')}
        </Button>
      </div>
    </Main>
  )
}

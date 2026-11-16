import { useI18n } from '@/i18n'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OnboardingWizardStep } from '../onboarding-view-model'

export function WizardProgress({
  onSelectStep,
  percent,
  steps,
}: {
  onSelectStep: (step: OnboardingWizardStep) => void
  percent: number
  steps: OnboardingWizardStep[]
}) {
  const { t } = useI18n()

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-4'>
        <p className='text-sm text-muted-foreground'>
          {t('onboardingUi.progress', { percent: String(percent) })}
        </p>
        <span className='text-sm font-medium tabular-nums'>{percent}%</span>
      </div>

      <div
        aria-label={t('onboardingUi.progressLabel')}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
        className='h-2 w-full overflow-hidden rounded-full bg-muted'
        role='progressbar'
      >
        <div
          className='h-full rounded-full bg-primary transition-[width] duration-300'
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className='grid gap-2 sm:grid-cols-2 lg:grid-cols-4'>
        {steps.map((step) => {
          const isNavigable = step.status !== 'upcoming'

          return (
            <li key={step.key}>
              <button
                aria-current={step.status === 'current' ? 'step' : undefined}
                className={cn(
                  'flex w-full items-start gap-2 rounded-md border p-3 text-start transition-colors',
                  step.status === 'current' && 'border-primary bg-primary/5',
                  isNavigable
                    ? 'hover:bg-muted/50'
                    : 'cursor-not-allowed opacity-60'
                )}
                disabled={!isNavigable}
                type='button'
                onClick={() => onSelectStep(step)}
              >
                <StepMarker index={step.index} status={step.status} />
                <span className='min-w-0'>
                  <span className='block truncate text-sm font-medium'>
                    {t(step.titleKey)}
                  </span>
                  <span className='block text-xs text-muted-foreground'>
                    {step.status === 'skipped'
                      ? t('onboardingUi.skipped')
                      : step.isOptional
                        ? t('onboardingUi.optional')
                        : t('onboardingUi.required')}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function StepMarker({
  index,
  status,
}: {
  index: number
  status: OnboardingWizardStep['status']
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
        status === 'done' &&
          'border-primary bg-primary text-primary-foreground',
        status === 'current' && 'border-primary text-primary',
        status === 'skipped' && 'border-dashed text-muted-foreground'
      )}
    >
      {status === 'done' ? (
        <Check className='h-3.5 w-3.5' />
      ) : status === 'skipped' ? (
        <Minus className='h-3.5 w-3.5' />
      ) : (
        index + 1
      )}
    </span>
  )
}

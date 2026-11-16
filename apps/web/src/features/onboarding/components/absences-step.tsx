import { useState } from 'react'
import { useI18n } from '@/i18n'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  MAX_ANNUAL_LEAVE_DAYS,
  MIN_ANNUAL_LEAVE_DAYS,
  validateAnnualLeaveDays,
} from '../onboarding-view-model'

export function AbsencesStep({
  defaultAnnualLeaveDays,
  isSaving,
  onSkip,
  onSubmit,
}: {
  defaultAnnualLeaveDays: number
  isSaving: boolean
  onSkip: () => void
  onSubmit: (annualLeaveDays: number) => void
}) {
  const { t } = useI18n()
  const [annualLeaveDays, setAnnualLeaveDays] = useState(
    String(defaultAnnualLeaveDays)
  )
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const result = validateAnnualLeaveDays(annualLeaveDays)

    if (!result.ok) {
      setError(
        t(result.messageKey, {
          max: String(MAX_ANNUAL_LEAVE_DAYS),
          min: String(MIN_ANNUAL_LEAVE_DAYS),
        })
      )
      return
    }

    setError(null)
    onSubmit(result.value)
  }

  return (
    <form className='space-y-5' noValidate onSubmit={handleSubmit}>
      <div className='grid gap-2 sm:max-w-xs'>
        <Label htmlFor='onboarding-leave-days'>
          {t('onboardingUi.absences.annualLeaveLabel')}
        </Label>
        <Input
          aria-describedby='onboarding-leave-days-help'
          aria-invalid={!!error}
          id='onboarding-leave-days'
          inputMode='decimal'
          value={annualLeaveDays}
          onChange={(event) => setAnnualLeaveDays(event.target.value)}
        />
        <p
          className='text-xs text-muted-foreground'
          id='onboarding-leave-days-help'
        >
          {t('onboardingUi.absences.annualLeaveHelp')}
        </p>
        {error && <p className='text-sm text-destructive'>{error}</p>}
      </div>

      <div className='rounded-md border bg-muted/20 p-4'>
        <p className='text-sm font-medium'>
          {t('onboardingUi.absences.includedTitle')}
        </p>
        <p className='mt-1 text-sm text-muted-foreground'>
          {t('onboardingUi.absences.includedDescription')}
        </p>
      </div>

      <div className='flex flex-wrap gap-2'>
        <Button disabled={isSaving} type='submit'>
          {isSaving && <Loader2 className='h-4 w-4 animate-spin' />}
          {t('onboardingUi.saveAndContinue')}
        </Button>
        <Button
          disabled={isSaving}
          type='button'
          variant='ghost'
          onClick={onSkip}
        >
          {t('onboardingUi.skipForNow')}
        </Button>
      </div>
    </form>
  )
}

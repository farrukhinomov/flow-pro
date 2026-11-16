import { useI18n } from '@/i18n'
import { Clock3, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

/**
 * Activation, not configuration. The wizard ends on a completed action rather than a finished form,
 * so the first thing the owner does in FlowPro is the thing the product is for.
 */
export function FirstClockInStep({
  isSaving,
  onClockIn,
  onSkip,
}: {
  isSaving: boolean
  onClockIn: () => void
  onSkip: () => void
}) {
  const { t } = useI18n()

  return (
    <div className='space-y-5'>
      <Card>
        <CardContent className='flex items-start gap-4 p-4'>
          <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground'>
            <Clock3 className='h-4 w-4' />
          </div>
          <div>
            <p className='text-sm font-medium'>
              {t('onboardingUi.firstClockIn.cardTitle')}
            </p>
            <p className='mt-1 text-sm text-muted-foreground'>
              {t('onboardingUi.firstClockIn.cardDescription')}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className='flex flex-wrap gap-2'>
        <Button disabled={isSaving} onClick={onClockIn}>
          {isSaving && <Loader2 className='h-4 w-4 animate-spin' />}
          {t('onboardingUi.firstClockIn.action')}
        </Button>
        <Button disabled={isSaving} variant='ghost' onClick={onSkip}>
          {t('onboardingUi.firstClockIn.skip')}
        </Button>
      </div>
    </div>
  )
}

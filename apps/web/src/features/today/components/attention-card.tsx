import { Link } from '@tanstack/react-router'
import { useI18n } from '@/i18n'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatDuration } from '../today-view-model'

type BreakComplianceSummary = {
  isCompliant: boolean
  missingBreakMs: number
  overMaxWorkMs: number
}

export function AttentionCard({
  breakCompliance,
  hasOpenYesterday,
  onCloseYesterday,
  onYesterdayCloseTimeChange,
  yesterdayCloseTime,
}: {
  breakCompliance: BreakComplianceSummary
  hasOpenYesterday: boolean
  onCloseYesterday: () => void
  onYesterdayCloseTimeChange: (value: string) => void
  yesterdayCloseTime: string
}) {
  const { t } = useI18n()
  return (
    <Card className='gap-4 py-4'>
      <CardHeader className='px-4 pb-0'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <AlertTriangle className='h-4 w-4 text-amber-500' />
          {t('todayAttentionUi.title')}
        </CardTitle>
        <CardDescription>{t('todayAttentionUi.description')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-3 px-4 text-sm'>
        {hasOpenYesterday && (
          <div className='rounded-lg border border-amber-200 bg-amber-500/10 p-3'>
            <div className='font-medium text-amber-700'>
              {t('todayAttentionUi.yesterdayStillOpen')}
            </div>
            <div className='mt-1 text-muted-foreground'>
              {t('todayAttentionUi.yesterdayStillOpenDescription')}
            </div>
            <div className='mt-3 flex gap-2'>
              <Input
                type='time'
                value={yesterdayCloseTime}
                onChange={(event) =>
                  onYesterdayCloseTimeChange(event.target.value)
                }
              />
              <Button type='button' onClick={onCloseYesterday}>
                {t('todayAttentionUi.closeDay')}
              </Button>
            </div>
          </div>
        )}
        {!breakCompliance.isCompliant && (
          <div className='rounded-lg border border-amber-200 bg-amber-500/10 p-3'>
            <div className='font-medium text-amber-700'>
              {t('todayAttentionUi.breakRuleWarning')}
            </div>
            <div className='mt-1 text-muted-foreground'>
              {breakCompliance.missingBreakMs > 0 &&
                t('todayAttentionUi.needBreakTime', {
                  duration: formatDuration(breakCompliance.missingBreakMs),
                })}
              {breakCompliance.overMaxWorkMs > 0 &&
                t('todayAttentionUi.aboveTenHourGuideline', {
                  duration: formatDuration(breakCompliance.overMaxWorkMs),
                })}
            </div>
          </div>
        )}
        {!hasOpenYesterday && breakCompliance.isCompliant && (
          <div className='rounded-lg border p-3'>
            {t('todayAttentionUi.noUrgentIssues')}
          </div>
        )}
        <Button variant='outline' size='sm' className='w-full' asChild>
          <Link to='/planning'>
            {t('todayAttentionUi.openPlanning')}
            <ArrowRight className='h-4 w-4' />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

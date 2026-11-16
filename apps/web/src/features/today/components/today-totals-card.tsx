import type { TodayProjection } from '@/domain/attendance/types'
import { useI18n } from '@/i18n'
import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatDuration, formatSignedDuration } from '../today-view-model'

export function TodayTotalsCard({
  eventsCount,
  projection,
}: {
  eventsCount: number
  projection: TodayProjection
}) {
  const { t } = useI18n()
  const flexValue =
    projection.state === 'finished'
      ? formatSignedDuration(projection.flexMs)
      : t('todayUi.inProgress')

  return (
    <Card className='gap-4 py-4'>
      <CardHeader className='px-4 pb-0'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <TrendingUp className='h-4 w-4 text-muted-foreground' />
          {t('todayUi.todayTotals')}
        </CardTitle>
        <CardDescription>
          {t('todayUi.calculatedFromLocalClockEvents')}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3 px-4'>
        <div className='space-y-2.5'>
          <SummaryLine
            label={t('todayUi.worked')}
            value={formatDuration(projection.workedMs)}
          />
          <SummaryLine
            label={t('todayUi.break')}
            value={formatDuration(projection.breakMs)}
          />
          <SummaryLine
            label={t('todayUi.flex')}
            value={flexValue}
            numeric={projection.state === 'finished'}
            valueClassName={
              projection.state === 'finished' && projection.flexMs >= 0
                ? 'text-emerald-500'
                : undefined
            }
          />
          <SummaryLine
            label={t('todayUi.bookings')}
            value={String(eventsCount)}
          />
        </div>

        <Separator />

        <div className='rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground'>
          {t('todayUi.monthlyBalancesHint')}
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryLine({
  label,
  value,
  valueClassName,
  numeric = true,
}: {
  label: string
  value: string
  valueClassName?: string
  // Monospace is for aligning figures. Status words such as "In progress" read
  // as a glitch in a typewriter face, so they stay in the body font.
  numeric?: boolean
}) {
  return (
    <div className='flex items-center justify-between gap-3'>
      <span className='text-sm text-muted-foreground'>{label}</span>
      <span
        className={cn(
          'text-sm font-semibold',
          numeric && 'font-mono tabular-nums',
          valueClassName
        )}
      >
        {value}
      </span>
    </div>
  )
}

import { useI18n } from '@/i18n'
import { CalendarDays } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DayWorkChart,
  TimelineLegend,
} from '@/features/timesheet/components/day-work-chart'
import { buildTimelineWindow } from '@/features/timesheet/components/day-work-chart-utils'
import type { DayRow } from '@/features/timesheet/types'

export function DayTimelineCard({
  industrial,
  rows,
}: {
  industrial: boolean
  rows: DayRow[]
}) {
  const { t } = useI18n()
  const timelineWindow = buildTimelineWindow(rows)

  return (
    <Card className='gap-4 overflow-hidden py-4'>
      <CardHeader className='gap-3 px-4 pb-0'>
        <div className='min-w-0 space-y-1'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <CalendarDays className='h-4 w-4 text-muted-foreground' />
            {t('timesheetUi.myTimesheets')}
          </CardTitle>
          <CardDescription>
            {t('todayUi.myTimesheetsDescription')}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className='p-0'>
        <div className='border-y bg-muted/20 px-4 py-2'>
          <TimelineLegend compact />
        </div>
        <div role='region' aria-label={t('timesheetUi.myTimesheets')}>
          {rows.map((row) => (
            <DayWorkChart
              key={row.date}
              compact
              industrial={industrial}
              row={row}
              showBadges={false}
              window={timelineWindow}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

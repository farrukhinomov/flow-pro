import { useI18n } from '@/i18n'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { officialTypes } from '../../request-view-model'

export function OfficialAbsenceForm({
  singleDate,
  setSingleDate,
  today,
  officialType,
  setOfficialType,
  clockIn,
  setClockIn,
  clockOut,
  setClockOut,
}: {
  singleDate: string
  setSingleDate: (v: string) => void
  today: string
  officialType: string
  setOfficialType: (v: string) => void
  clockIn: string
  setClockIn: (v: string) => void
  clockOut: string
  setClockOut: (v: string) => void
}) {
  const { t } = useI18n()
  return (
    <>
      <div className='grid gap-4 sm:grid-cols-[180px_1fr]'>
        <div className='space-y-2'>
          <Label htmlFor='official-date'>{t('requestsUi.date')}</Label>
          <Input
            id='official-date'
            type='date'
            value={singleDate}
            max={today}
            onChange={(event) => setSingleDate(event.target.value)}
          />
        </div>
        <div className='space-y-2'>
          <Label>{t('requestsUi.officialAbsenceType')}</Label>
          <Select value={officialType} onValueChange={setOfficialType}>
            <SelectTrigger aria-label={t('requestsUi.officialAbsenceType')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {officialTypes.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {t(item.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {officialType !== 'full-day' && (
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='official-start'>{t('requestsUi.beginning')}</Label>
            <Input
              id='official-start'
              type='time'
              value={clockIn}
              onChange={(event) => setClockIn(event.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='official-end'>{t('requestsUi.end')}</Label>
            <Input
              id='official-end'
              type='time'
              value={clockOut}
              onChange={(event) => setClockOut(event.target.value)}
            />
          </div>
        </div>
      )}
    </>
  )
}

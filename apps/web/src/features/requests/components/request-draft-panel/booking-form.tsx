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
import { bookingTypes } from '../../request-view-model'

export function BookingForm({
  singleDate,
  setSingleDate,
  today,
  bookingType,
  setBookingType,
  clockIn,
  setClockIn,
  clockOut,
  setClockOut,
}: {
  singleDate: string
  setSingleDate: (v: string) => void
  today: string
  bookingType: string
  setBookingType: (v: string) => void
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
          <Label htmlFor='booking-date'>{t('requestsUi.date')}</Label>
          <Input
            id='booking-date'
            type='date'
            value={singleDate}
            max={today}
            onChange={(event) => setSingleDate(event.target.value)}
          />
        </div>
        <div className='space-y-2'>
          <Label>{t('requestsUi.correctionType')}</Label>
          <Select value={bookingType} onValueChange={setBookingType}>
            <SelectTrigger aria-label={t('requestsUi.correctionType')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {bookingTypes.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {t(item.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-2'>
          <Label htmlFor='clock-in'>{t('requestsUi.clockIn')}</Label>
          <Input
            id='clock-in'
            type='time'
            value={clockIn}
            onChange={(event) => setClockIn(event.target.value)}
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='clock-out'>{t('requestsUi.clockOut')}</Label>
          <Input
            id='clock-out'
            type='time'
            value={clockOut}
            onChange={(event) => setClockOut(event.target.value)}
          />
        </div>
      </div>
    </>
  )
}

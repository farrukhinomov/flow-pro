import type { RequestPartialDayMode } from '@/domain/requests/types'
import { useI18n } from '@/i18n'
import { Repeat } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { partialDayOptions } from '../../request-view-model'

type Option = { value: string; label: string }

export function AbsenceForm(props: {
  fromDate: string
  toDate: string
  setFromDate: (v: string) => void
  setToDate: (v: string) => void
  absenceType: string
  setAbsenceType: (v: string) => void
  absenceTypes: Option[]
  partialDayMode: RequestPartialDayMode
  setPartialDayMode: (v: RequestPartialDayMode) => void
  recurrenceFrequency: 'none' | 'weekly'
  setRecurrenceFrequency: (v: 'none' | 'weekly') => void
  recurrenceOccurrences: number
  setRecurrenceOccurrences: (v: number) => void
  partialStartTime: string
  setPartialStartTime: (v: string) => void
  partialEndTime: string
  setPartialEndTime: (v: string) => void
}) {
  const { t } = useI18n()
  return (
    <>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-2'>
          <Label htmlFor='from-date'>{t('requestsUi.from')}</Label>
          <Input
            id='from-date'
            type='date'
            value={props.fromDate}
            onChange={(event) => {
              props.setFromDate(event.target.value)
              if (event.target.value > props.toDate)
                props.setToDate(event.target.value)
            }}
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='to-date'>{t('requestsUi.to')}</Label>
          <Input
            id='to-date'
            type='date'
            min={props.fromDate}
            value={props.toDate}
            onChange={(event) => props.setToDate(event.target.value)}
          />
        </div>
      </div>

      <div className='space-y-2'>
        <Label>{t('requestsUi.absenceType')}</Label>
        <Select value={props.absenceType} onValueChange={props.setAbsenceType}>
          <SelectTrigger
            className='w-full'
            aria-label={t('requestsUi.absenceType')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {props.absenceTypes.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-2'>
          <Label>{t('requestsUi.dayLength')}</Label>
          <Select
            value={props.partialDayMode}
            onValueChange={(value) =>
              props.setPartialDayMode(value as RequestPartialDayMode)
            }
          >
            <SelectTrigger
              className='w-full'
              aria-label={t('requestsUi.dayLength')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {partialDayOptions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {t(item.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-2'>
          <Label className='flex items-center gap-2'>
            <Repeat className='h-3.5 w-3.5 text-muted-foreground' />
            {t('requestsUi.repeat')}
          </Label>
          <Select
            value={props.recurrenceFrequency}
            onValueChange={(value) =>
              props.setRecurrenceFrequency(value as 'none' | 'weekly')
            }
          >
            <SelectTrigger
              className='w-full'
              aria-label={t('requestsUi.repeat')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='none'>
                {t('requestsUi.doesNotRepeat')}
              </SelectItem>
              <SelectItem value='weekly'>{t('requestsUi.weekly')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {(props.partialDayMode === 'custom' ||
        props.recurrenceFrequency === 'weekly') && (
        <div className='grid gap-4 sm:grid-cols-3'>
          {props.partialDayMode === 'custom' && (
            <>
              <div className='space-y-2'>
                <Label htmlFor='partial-start'>{t('timesheetUi.start')}</Label>
                <Input
                  id='partial-start'
                  type='time'
                  value={props.partialStartTime}
                  onChange={(event) =>
                    props.setPartialStartTime(event.target.value)
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='partial-end'>{t('requestsUi.end')}</Label>
                <Input
                  id='partial-end'
                  type='time'
                  value={props.partialEndTime}
                  onChange={(event) =>
                    props.setPartialEndTime(event.target.value)
                  }
                />
              </div>
            </>
          )}
          {props.recurrenceFrequency === 'weekly' && (
            <div className='space-y-2'>
              <Label htmlFor='repeat-count'>
                {t('requestsUi.occurrences')}
              </Label>
              <Input
                id='repeat-count'
                type='number'
                min={1}
                max={12}
                value={props.recurrenceOccurrences}
                onChange={(event) =>
                  props.setRecurrenceOccurrences(
                    Math.max(1, Math.min(12, Number(event.target.value) || 1))
                  )
                }
              />
            </div>
          )}
        </div>
      )}
    </>
  )
}

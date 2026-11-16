import {
  addMonths,
  getYear,
  isAfter,
  isBefore,
  setMonth,
  setYear,
  startOfMonth,
} from 'date-fns'
import { useI18n } from '@/i18n'
import { formatLocaleDate } from '@/i18n/format'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type MonthYearPickerProps = {
  value: Date
  onChange: (date: Date) => void
  min?: Date
  max?: Date
  className?: string
  disabled?: boolean
}

function clampToBounds(date: Date, min: Date, max: Date) {
  if (isBefore(date, min)) return min
  if (isAfter(date, max)) return max
  return date
}

export function MonthYearPicker({
  value,
  onChange,
  min,
  max,
  className,
  disabled = false,
}: MonthYearPickerProps) {
  const { locale, t } = useI18n()
  const normalizedValue = startOfMonth(value)
  const minDate = startOfMonth(
    min ?? new Date(getYear(normalizedValue) - 2, 0, 1)
  )
  const maxDate = startOfMonth(
    max ?? new Date(getYear(normalizedValue) + 2, 11, 1)
  )
  const previousMonth = addMonths(normalizedValue, -1)
  const nextMonth = addMonths(normalizedValue, 1)
  const canGoPrevious = !disabled && !isBefore(previousMonth, minDate)
  const canGoNext = !disabled && !isAfter(nextMonth, maxDate)
  const yearOptions = Array.from(
    { length: getYear(maxDate) - getYear(minDate) + 1 },
    (_, index) => getYear(minDate) + index
  )
  const monthOptions = Array.from({ length: 12 }, (_, monthIndex) => {
    const optionDate = startOfMonth(
      setMonth(
        setYear(normalizedValue, normalizedValue.getFullYear()),
        monthIndex
      )
    )

    return {
      value: String(monthIndex),
      label: formatLocaleDate(new Date(2026, monthIndex, 1), locale, {
        month: 'long',
      }),
      disabled: isBefore(optionDate, minDate) || isAfter(optionDate, maxDate),
    }
  })

  return (
    <div
      className={cn(
        'grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(5.5rem,auto)_2.25rem] items-center rounded-md border bg-background',
        className
      )}
    >
      <Button
        variant='ghost'
        size='icon'
        className='h-9 w-9 rounded-r-none'
        disabled={!canGoPrevious}
        aria-label={t('periodPicker.previousMonth')}
        onClick={() => onChange(previousMonth)}
      >
        <ChevronLeft className='h-4 w-4' />
      </Button>

      <Select
        value={String(normalizedValue.getMonth())}
        disabled={disabled}
        onValueChange={(nextMonthValue) => {
          const nextDate = clampToBounds(
            startOfMonth(setMonth(normalizedValue, Number(nextMonthValue))),
            minDate,
            maxDate
          )
          onChange(nextDate)
        }}
      >
        <SelectTrigger
          className='h-9 w-full rounded-none border-y-0 border-l-0'
          aria-label={t('periodPicker.month')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {monthOptions.map((monthOption) => (
            <SelectItem
              key={monthOption.value}
              value={monthOption.value}
              disabled={monthOption.disabled}
            >
              {monthOption.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(normalizedValue.getFullYear())}
        disabled={disabled}
        onValueChange={(nextYearValue) => {
          const nextDate = clampToBounds(
            startOfMonth(setYear(normalizedValue, Number(nextYearValue))),
            minDate,
            maxDate
          )
          onChange(nextDate)
        }}
      >
        <SelectTrigger
          className='h-9 w-full rounded-none border-y-0 border-l'
          aria-label={t('periodPicker.year')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {yearOptions.map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant='ghost'
        size='icon'
        className='h-9 w-9 rounded-l-none'
        disabled={!canGoNext}
        aria-label={t('periodPicker.nextMonth')}
        onClick={() => onChange(nextMonth)}
      >
        <ChevronRight className='h-4 w-4' />
      </Button>
    </div>
  )
}

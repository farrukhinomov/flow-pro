import { useI18n } from '@/i18n'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type MultiSelectChipsProps = {
  values: string[]
  options: string[]
  placeholder: string
  emptyLabel?: string
  clearLabel?: string
  disabled?: boolean
  onChange: (next: string[]) => void
}

export function MultiSelectChips({
  values,
  options,
  placeholder,
  emptyLabel,
  clearLabel,
  disabled = false,
  onChange,
}: MultiSelectChipsProps) {
  const { t } = useI18n()
  const availableOptions = options.filter((item) => !values.includes(item))
  const resolvedEmptyLabel = emptyLabel ?? t('common.noItemsSelected')
  const resolvedClearLabel = clearLabel ?? t('common.clearAll')

  return (
    <div className='space-y-2'>
      <div className='flex flex-wrap gap-2'>
        {values.length > 0 ? (
          values.map((value) => (
            <Badge
              key={value}
              variant='secondary'
              className='inline-flex items-center gap-1'
            >
              {value}
              <button
                type='button'
                className='rounded-sm p-0.5 hover:bg-muted disabled:opacity-50'
                disabled={disabled}
                onClick={() =>
                  onChange(values.filter((item) => item !== value))
                }
                aria-label={`Remove ${value}`}
              >
                <X className='h-3.5 w-3.5' />
              </button>
            </Badge>
          ))
        ) : (
          <p className='text-xs text-muted-foreground'>{resolvedEmptyLabel}</p>
        )}
      </div>
      <div className='flex gap-2'>
        <Select
          disabled={disabled || availableOptions.length === 0}
          onValueChange={(value) => onChange([...values, value])}
        >
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {availableOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type='button'
          variant='outline'
          disabled={disabled || values.length === 0}
          onClick={() => onChange([])}
        >
          {resolvedClearLabel}
        </Button>
      </div>
    </div>
  )
}

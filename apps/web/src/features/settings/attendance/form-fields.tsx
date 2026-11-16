import { getVisibilityOptions } from '@/domain/attendance/policies'
import type {
  PeriodWindowPolicy,
  VisibilityLevel,
} from '@/domain/attendance/types'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function PeriodWindowFields({
  description,
  disabled,
  monthsBackLabel,
  monthsForwardLabel,
  onChange,
  policy,
  title,
}: {
  description: string
  disabled: boolean
  monthsBackLabel: string
  monthsForwardLabel: string
  onChange: (patch: Partial<PeriodWindowPolicy>) => void
  policy: PeriodWindowPolicy
  title: string
}) {
  return (
    <div className='rounded-md border p-3'>
      <div>
        <p className='text-sm font-medium'>{title}</p>
        <p className='mt-1 text-xs text-muted-foreground'>{description}</p>
      </div>
      <div className='mt-3 grid gap-3 sm:grid-cols-2'>
        <div className='space-y-2'>
          <Label>{monthsBackLabel}</Label>
          <Input
            type='number'
            min={0}
            value={policy.monthsBack}
            disabled={disabled}
            onChange={(event) =>
              onChange({ monthsBack: Number(event.target.value) })
            }
          />
        </div>
        <div className='space-y-2'>
          <Label>{monthsForwardLabel}</Label>
          <Input
            type='number'
            min={0}
            value={policy.monthsForward}
            disabled={disabled}
            onChange={(event) =>
              onChange({ monthsForward: Number(event.target.value) })
            }
          />
        </div>
      </div>
    </div>
  )
}

export function VisibilityBadge({ value }: { value: VisibilityLevel }) {
  const label = getVisibilityOptions().find(
    (option) => option.value === value
  )?.label

  return (
    <Badge
      variant='outline'
      className={cn(
        'text-xs',
        value === 'hidden' && 'border-slate-200 bg-slate-500/10 text-slate-600',
        value === 'state-only' &&
          'border-blue-200 bg-blue-500/10 text-blue-600',
        value === 'operational' &&
          'border-amber-200 bg-amber-500/10 text-amber-600',
        value === 'full' &&
          'border-emerald-200 bg-emerald-500/10 text-emerald-600'
      )}
    >
      {label}
    </Badge>
  )
}

export function PolicyMetric({
  description,
  title,
  value,
}: {
  description: string
  title: string
  value: string
}) {
  return (
    <div className='rounded-md border p-3'>
      <p className='text-xs text-muted-foreground'>{title}</p>
      <p className='mt-1 text-xl font-semibold'>{value}</p>
      <p className='text-xs text-muted-foreground'>{description}</p>
    </div>
  )
}

export function VisibilitySelect({
  disabled = false,
  label,
  value,
  onChange,
}: {
  disabled?: boolean
  label: string
  value: VisibilityLevel
  onChange: (value: VisibilityLevel) => void
}) {
  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(next) => onChange(next as VisibilityLevel)}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {getVisibilityOptions().map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function ToggleRow({
  active,
  disabled = false,
  label,
  onToggle,
}: {
  active: boolean
  disabled?: boolean
  label: string
  onToggle: () => void
}) {
  const { t } = useI18n()

  return (
    <button
      type='button'
      disabled={disabled}
      onClick={onToggle}
      className='flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60'
    >
      <span>{label}</span>
      <Badge variant={active ? 'default' : 'outline'}>
        {active ? t('common.yes') : t('common.no')}
      </Badge>
    </button>
  )
}

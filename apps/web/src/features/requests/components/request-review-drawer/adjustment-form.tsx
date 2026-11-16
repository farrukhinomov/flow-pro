import type { Dispatch, SetStateAction } from 'react'
import type {
  EmployeeRequest,
  RequestPartialDayMode,
} from '@/domain/requests/types'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'
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

type AdjustmentState = {
  adjustedFromDate: string
  adjustedToDate: string
  adjustedClockIn: string
  adjustedClockOut: string
  adjustedPartialMode: RequestPartialDayMode
  adjustedPartialStart: string
  adjustedPartialEnd: string
}

export function RequestAdjustmentForm({
  isAdjusting,
  request,
  setIsAdjusting,
  state,
  setState,
  hasAdjustment,
}: {
  isAdjusting: boolean
  request: EmployeeRequest
  setIsAdjusting: Dispatch<SetStateAction<boolean>>
  state: AdjustmentState
  setState: Dispatch<SetStateAction<AdjustmentState>>
  hasAdjustment: boolean
}) {
  const { t } = useI18n()
  return (
    <div className='space-y-3 rounded-md border p-4'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <div className='text-sm font-medium'>
            {t('requestsUi.approveWithChanges')}
          </div>
          <p className='mt-1 text-sm text-muted-foreground'>
            {t('requestsUi.approveWithChangesDescription')}
          </p>
        </div>
        <Button
          type='button'
          variant={isAdjusting ? 'secondary' : 'outline'}
          size='sm'
          disabled={request.status !== 'submitted'}
          onClick={() => setIsAdjusting((current) => !current)}
        >
          {isAdjusting ? t('requestsUi.editing') : t('requestsUi.edit')}
        </Button>
      </div>

      {isAdjusting && (
        <div className='space-y-4'>
          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='adjusted-from'>{t('requestsUi.from')}</Label>
              <Input
                id='adjusted-from'
                type='date'
                value={state.adjustedFromDate}
                onChange={(event) => {
                  const nextFromDate = event.target.value
                  setState((current) => ({
                    ...current,
                    adjustedFromDate: nextFromDate,
                    adjustedToDate:
                      nextFromDate > current.adjustedToDate
                        ? nextFromDate
                        : current.adjustedToDate,
                  }))
                }}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='adjusted-to'>{t('requestsUi.to')}</Label>
              <Input
                id='adjusted-to'
                type='date'
                min={state.adjustedFromDate}
                value={state.adjustedToDate}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    adjustedToDate: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          {request.kind === 'absence' ? (
            <>
              <div className='space-y-2'>
                <Label>{t('requestsUi.dayLength')}</Label>
                <Select
                  value={state.adjustedPartialMode}
                  onValueChange={(value) =>
                    setState((current) => ({
                      ...current,
                      adjustedPartialMode: value as RequestPartialDayMode,
                    }))
                  }
                >
                  <SelectTrigger aria-label={t('requestsUi.adjustedDayLength')}>
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
              {state.adjustedPartialMode === 'custom' && (
                <div className='grid gap-3 sm:grid-cols-2'>
                  <div className='space-y-2'>
                    <Label htmlFor='adjusted-partial-start'>
                      {t('timesheetUi.start')}
                    </Label>
                    <Input
                      id='adjusted-partial-start'
                      type='time'
                      value={state.adjustedPartialStart}
                      onChange={(event) =>
                        setState((current) => ({
                          ...current,
                          adjustedPartialStart: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='adjusted-partial-end'>
                      {t('requestsUi.end')}
                    </Label>
                    <Input
                      id='adjusted-partial-end'
                      type='time'
                      value={state.adjustedPartialEnd}
                      onChange={(event) =>
                        setState((current) => ({
                          ...current,
                          adjustedPartialEnd: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className='grid gap-3 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='adjusted-clock-in'>
                  {t('requestsUi.clockIn')}
                </Label>
                <Input
                  id='adjusted-clock-in'
                  type='time'
                  value={state.adjustedClockIn}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      adjustedClockIn: event.target.value,
                    }))
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='adjusted-clock-out'>
                  {t('requestsUi.clockOut')}
                </Label>
                <Input
                  id='adjusted-clock-out'
                  type='time'
                  value={state.adjustedClockOut}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      adjustedClockOut: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          )}

          {!hasAdjustment && (
            <p className='text-xs text-muted-foreground'>
              {t('requestsUi.adjustmentRequired')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export type { AdjustmentState }

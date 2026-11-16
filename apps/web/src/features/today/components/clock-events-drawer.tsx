import { useState } from 'react'
import type { ClockEvent, WorkLocation } from '@/domain/attendance/types'
import { useI18n } from '@/i18n'
import { Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/flowpro/empty-state'
import { FlowProDrawer } from '@/components/flowpro/flowpro-drawer'
import { DrawerPanelSkeleton } from '@/components/flowpro/loading-skeletons'
import {
  canEditClockEvent,
  eventDateTimeValue,
  getEventTypeLabel,
  getSourceLabel,
} from '../today-view-model'

function toIsoFromDateTimeLocal(value: string) {
  if (!value) return undefined

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export function ClockEventsDrawer({
  events,
  isLoading = false,
  onOpenChange,
  onRemove,
  onSave,
  open,
}: {
  events: ClockEvent[]
  isLoading?: boolean
  onOpenChange: (open: boolean) => void
  onRemove: (event: ClockEvent, reason: string) => Promise<void>
  onSave: (event: ClockEvent, reason: string) => Promise<void>
  open: boolean
}) {
  const { t } = useI18n()
  return (
    <FlowProDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t('todayUi.manageTodaysBookings')}
      description={t('todayUi.manageTodaysBookingsDescription')}
      status={t('timesheetUi.eventsCount', { count: events.length })}
      meta={t('today.title')}
      footer={
        <Button
          type='button'
          variant='outline'
          onClick={() => onOpenChange(false)}
        >
          {t('common.close')}
        </Button>
      }
    >
      <div className='space-y-4'>
        {isLoading ? (
          <>
            <DrawerPanelSkeleton rows={2} />
            <DrawerPanelSkeleton rows={2} />
            <DrawerPanelSkeleton rows={2} />
          </>
        ) : events.length === 0 ? (
          <EmptyState
            className='min-h-48'
            title={t('todayUi.noBookingsToday')}
            description={t('todayUi.noBookingsTodayDescription')}
          />
        ) : (
          events.map((event) => (
            <ClockEventEditor
              key={`${event.id}-${event.occurredAt}-${event.source}-${event.syncState}`}
              event={event}
              onRemove={onRemove}
              onSave={onSave}
            />
          ))
        )}
      </div>
    </FlowProDrawer>
  )
}

function ClockEventEditor({
  event,
  onRemove,
  onSave,
}: {
  event: ClockEvent
  onRemove: (event: ClockEvent, reason: string) => Promise<void>
  onSave: (event: ClockEvent, reason: string) => Promise<void>
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(event)
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [reason, setReason] = useState('')
  const isEditable = canEditClockEvent(event)
  const hasChanges =
    draft.occurredAt !== event.occurredAt || draft.location !== event.location
  const hasReason = reason.trim().length > 0
  const eventTypeLabel = getEventTypeLabel(event.type, t)
  const eventSourceLabel = getSourceLabel(event.source, t)

  const save = async () => {
    if (!isEditable || !hasChanges || !hasReason) return

    setIsSaving(true)

    try {
      await onSave(draft, reason.trim())
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async () => {
    if (!isEditable || !hasReason) return

    setIsSaving(true)

    try {
      await onRemove(event, reason.trim())
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      aria-label={`${eventTypeLabel} ${eventSourceLabel} ${event.syncState}`}
      className='rounded-md border p-4'
      data-testid='clock-event-editor'
      role='group'
    >
      <div className='mb-3 flex items-center justify-between gap-3'>
        <div>
          <div className='text-sm font-medium capitalize'>{eventTypeLabel}</div>
          <div className='mt-1 text-xs text-muted-foreground'>
            {eventSourceLabel} ·{' '}
            {event.device?.label ?? t('todayUi.noDeviceRecorded')}
          </div>
        </div>
        <Badge variant='outline' className='capitalize'>
          {event.syncState}
        </Badge>
      </div>

      {!isEditable && (
        <div
          className='mb-3 rounded-md border border-amber-200 bg-amber-500/10 p-3 text-xs text-amber-700'
          role='status'
        >
          {t('todayUi.bookingSyncPendingNotice')}
        </div>
      )}

      <div className='grid gap-3 sm:grid-cols-2'>
        <div className='space-y-2'>
          <Label htmlFor={`${event.id}-time`}>{t('todayUi.time')}</Label>
          <Input
            id={`${event.id}-time`}
            type='datetime-local'
            disabled={isSaving || !isEditable}
            value={eventDateTimeValue(draft.occurredAt)}
            onChange={(change) => {
              const occurredAt = toIsoFromDateTimeLocal(change.target.value)

              if (!occurredAt) return

              setDraft({ ...draft, occurredAt })
            }}
          />
        </div>

        <div className='space-y-2 sm:col-span-2'>
          <Label>{t('todayUi.source')}</Label>
          <div className='rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground'>
            {getSourceLabel(event.source, t)}
          </div>
        </div>

        {draft.type === 'clock-in' && (
          <div className='space-y-2 sm:col-span-2'>
            <Label>{t('todayUi.location')}</Label>
            <Select
              disabled={isSaving || !isEditable}
              value={draft.location ?? 'office'}
              onValueChange={(value) =>
                setDraft({
                  ...draft,
                  location: value as WorkLocation,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='office'>{t('common.office')}</SelectItem>
                <SelectItem value='home-office'>
                  {t('common.homeOffice')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {draft.geo && (
        <div className='mt-3 rounded-md bg-muted/30 p-2 text-xs text-muted-foreground'>
          {t('todayUi.location')}: {draft.geo.latitude.toFixed(5)},{' '}
          {draft.geo.longitude.toFixed(5)}
        </div>
      )}

      <div className='mt-3 space-y-2'>
        <Label htmlFor={`${event.id}-reason`}>
          {t('todayUi.correctionReason')}
        </Label>
        <Textarea
          id={`${event.id}-reason`}
          rows={2}
          value={reason}
          disabled={isSaving || !isEditable}
          placeholder={t('todayUi.correctionReasonPlaceholder')}
          onChange={(change) => setReason(change.target.value)}
        />
      </div>

      {isConfirmingRemove && (
        <div className='mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm'>
          <div className='font-medium text-destructive'>
            {t('todayUi.deleteBookingQuestion')}
          </div>
          <p className='mt-1 text-muted-foreground'>
            {t('todayUi.deleteBookingDescription')}
          </p>
        </div>
      )}

      <div className='mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end'>
        {isConfirmingRemove ? (
          <>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={isSaving}
              onClick={() => setIsConfirmingRemove(false)}
            >
              {t('todayUi.keepBooking')}
            </Button>
            <Button
              type='button'
              variant='destructive'
              size='sm'
              disabled={!hasReason || isSaving}
              onClick={() => void remove()}
            >
              {t('todayUi.deleteBooking')}
            </Button>
          </>
        ) : (
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='gap-2'
            disabled={isSaving || !isEditable}
            onClick={() => setIsConfirmingRemove(true)}
          >
            <Trash2 className='h-4 w-4' />
            {t('requestsUi.delete')}
          </Button>
        )}
        <Button
          type='button'
          size='sm'
          disabled={!hasChanges || !hasReason || isSaving || !isEditable}
          onClick={() => void save()}
        >
          {t('todayUi.saveEvent')}
        </Button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { requestWorkflow } from '@/application/request-workflow'
import { resolveApiErrorMessage } from '@/data/api/api-error'
import type {
  AttendancePolicyConfig,
  ClockEventType,
  ProposedClockEvent,
  WorkLocation,
} from '@/domain/attendance/types'
import { buildRequestApprovalFlow } from '@/domain/requests/approval-routing'
import type { EmployeeUser } from '@/domain/users/types'
import { useI18n } from '@/i18n'
import { formatLocaleDate } from '@/i18n/format'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FlowProDrawer } from '@/components/flowpro/flowpro-drawer'
import type { DayRow } from '../types'

const eventTypes: ClockEventType[] = [
  'clock-in',
  'start-break',
  'resume-work',
  'clock-out',
]

export function TimeCorrectionDrawer({
  employeeId,
  employeeName,
  onOpenChange,
  policyConfig,
  row,
  users,
}: {
  employeeId: string
  employeeName: string
  onOpenChange: (open: boolean) => void
  policyConfig: AttendancePolicyConfig
  row: DayRow | null
  users: EmployeeUser[]
}) {
  const { locale, t } = useI18n()
  const [events, setEvents] = useState<ProposedClockEvent[]>(() =>
    row ? buildEventsFromRow(row) : []
  )
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editedRow, setEditedRow] = useState(row)

  // Opening the drawer for another day starts a fresh draft. Resetting during render
  // instead of in an effect avoids rendering once with the previous day's events.
  if (row !== editedRow) {
    setEditedRow(row)
    setEvents(row ? buildEventsFromRow(row) : [])
    setReason('')
  }

  if (!row) return null

  const originalEvents = buildEventsFromRow(row)
  const correctionDeltaMinutes = calculateCorrectionDeltaMinutes(
    originalEvents,
    events
  )
  const hasReason = reason.trim().length > 0
  const hasCorrectionChanges = correctionDeltaMinutes > 0
  const canSubmit = hasReason && hasCorrectionChanges && !isSubmitting
  const employee = users.find((user) => user.id === employeeId)
  const approvalFlow = buildRequestApprovalFlow({
    attendanceTypes: [],
    config: policyConfig,
    draft: { correctionDeltaMinutes, kind: 'booking-correction' },
    employee,
    users,
  })
  const dayLabel = formatLocaleDate(`${row.date}T12:00:00`, locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const updateEvent = (id: string, patch: Partial<ProposedClockEvent>) => {
    setEvents((current) =>
      current
        .map((event) => (event.id === id ? { ...event, ...patch } : event))
        .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    )
  }

  const addEvent = (type: ClockEventType) => {
    const occurredAt = new Date(`${row.date}T12:00:00`).toISOString()
    setEvents((current) => [
      ...current,
      {
        id: `proposed-${type}-${Date.now()}`,
        occurredAt,
        type,
        location: type === 'clock-in' ? 'office' : undefined,
      },
    ])
  }

  const submitCorrection = async () => {
    if (!canSubmit) return

    setIsSubmitting(true)
    try {
      const [command] = await requestWorkflow.submitRequest({
        actor: { displayName: employeeName, employeeId },
        draft: {
          approvalFlow,
          clockIn: firstEventTime(events, 'clock-in'),
          clockOut: firstEventTime(events, 'clock-out'),
          correctionDeltaMinutes,
          fromDate: row.date,
          kind: 'booking-correction',
          proposedEvents: events,
          reason: reason.trim(),
          subtype: t('timesheetUi.correction'),
          toDate: row.date,
        },
      })
      toast.success(
        command?.request.status === 'approved'
          ? t('timesheetUi.timesheetChangeAutoApproved')
          : t('timesheetUi.correctionRequestSubmitted')
      )
      onOpenChange(false)
    } catch (error) {
      toast.error(
        resolveApiErrorMessage(
          error,
          t,
          'timesheetUi.unableToSubmitCorrectionRequest'
        )
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <FlowProDrawer
      open={!!row}
      onOpenChange={onOpenChange}
      title={t('timesheetUi.editDayBookings')}
      description={t('timesheetUi.editDayBookingsDescription')}
      status={
        approvalFlow.autoApproved
          ? t('timesheetUi.autoApprovedByPolicy')
          : undefined
      }
      meta={dayLabel}
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            {t('syncUi.cancel')}
          </Button>
          <Button
            type='button'
            disabled={!canSubmit}
            onClick={() => void submitCorrection()}
          >
            {isSubmitting
              ? t('requestsUi.submitting')
              : t('timesheetUi.submitChanges')}
          </Button>
        </>
      }
    >
      <div className='space-y-5'>
        <div className='rounded-md border bg-muted/20 p-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <div className='text-sm font-medium'>
                {t('timesheetUi.approvalRoute')}
              </div>
              <div className='mt-1 text-xs text-muted-foreground'>
                {approvalFlow.autoApproved
                  ? t('timesheetUi.autoApprovedAuditHint')
                  : approvalFlow.steps
                      .map(
                        (step) =>
                          `${stepLabel(step.id, t)}: ${step.approverNames.join(', ')}`
                      )
                      .join(' → ') || t('timesheetUi.hrReview')}
              </div>
            </div>
            <Badge variant='outline'>
              {t('timesheetUi.eventsCount', { count: events.length })}
            </Badge>
          </div>
        </div>

        <div className='space-y-3'>
          {events.map((event) => (
            <EventEditor
              key={event.id}
              event={event}
              disabled={isSubmitting}
              t={t}
              onChange={(patch) => updateEvent(event.id, patch)}
              onRemove={() =>
                setEvents((current) =>
                  current.filter((item) => item.id !== event.id)
                )
              }
            />
          ))}
        </div>

        <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
          {eventTypes.map((type) => (
            <Button
              key={type}
              type='button'
              variant='outline'
              size='sm'
              disabled={isSubmitting}
              aria-label={t('timesheetUi.addEventType', {
                type: eventLabel(type, t),
              })}
              onClick={() => addEvent(type)}
            >
              <Plus className='h-4 w-4' />
              {eventLabel(type, t)}
            </Button>
          ))}
        </div>

        <div className='space-y-2'>
          <Label htmlFor='correction-reason'>{t('usersUi.reason')}</Label>
          <Textarea
            id='correction-reason'
            rows={3}
            maxLength={255}
            value={reason}
            disabled={isSubmitting}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('timesheetUi.correctionReasonExample')}
            className='resize-none'
          />
        </div>
      </div>
    </FlowProDrawer>
  )
}

function EventEditor({
  disabled = false,
  event,
  onChange,
  onRemove,
  t,
}: {
  disabled?: boolean
  event: ProposedClockEvent
  onChange: (patch: Partial<ProposedClockEvent>) => void
  onRemove: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  return (
    <div className='grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end'>
      <div className='space-y-2'>
        <Label>{t('timesheetUi.event')}</Label>
        <Select
          disabled={disabled}
          value={event.type}
          onValueChange={(value) => onChange({ type: value as ClockEventType })}
        >
          <SelectTrigger
            aria-label={t('timesheetUi.selectEventType', {
              type: eventLabel(event.type, t),
            })}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {eventTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {eventLabel(type, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className='space-y-2'>
        <Label>{t('timesheetUi.time')}</Label>
        <Input
          type='time'
          disabled={disabled}
          value={localTime(event.occurredAt)}
          onChange={(change) =>
            onChange({
              occurredAt: replaceTime(event.occurredAt, change.target.value),
            })
          }
        />
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            disabled={disabled}
            aria-label={t('timesheetUi.removeEvent')}
            onClick={onRemove}
          >
            <Trash2 className='h-4 w-4 text-rose-500' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('timesheetUi.removeEvent')}</TooltipContent>
      </Tooltip>
      {(event.type === 'clock-in' || event.type === 'resume-work') && (
        <div className='space-y-2 sm:col-span-2'>
          <Label>{t('timesheetUi.workLocation')}</Label>
          <Select
            disabled={disabled}
            value={event.location ?? 'office'}
            onValueChange={(value) =>
              onChange({ location: value as WorkLocation })
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
  )
}

function buildEventsFromRow(row: DayRow): ProposedClockEvent[] {
  const events: ProposedClockEvent[] = []

  row.clockIns.forEach((clockIn, index) => {
    const clockOut = row.clockOuts[index]
    events.push({
      id: `proposed-in-${index}`,
      occurredAt: isoAt(row.date, clockIn),
      type: index === 0 ? 'clock-in' : 'resume-work',
      location: clockOut?.includes('HO') ? 'home-office' : 'office',
    })
    if (!clockOut || clockOut.startsWith('--')) return
    events.push({
      id: `proposed-out-${index}`,
      occurredAt: isoAt(row.date, clockOut),
      type: clockOut.includes('Pa') ? 'start-break' : 'clock-out',
    })
  })

  return events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
}

function isoAt(date: string, time: string) {
  return new Date(`${date}T${time.slice(0, 5)}:00`).toISOString()
}

function localTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function replaceTime(value: string, time: string) {
  if (!/^\d{2}:\d{2}$/.test(time)) return value

  const date = new Date(value)
  const [hours, minutes] = time.split(':').map(Number)

  if (
    Number.isNaN(date.getTime()) ||
    hours === undefined ||
    minutes === undefined ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return value
  }

  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

function calculateCorrectionDeltaMinutes(
  originalEvents: ProposedClockEvent[],
  proposedEvents: ProposedClockEvent[]
) {
  if (originalEvents.length !== proposedEvents.length) {
    return Number.POSITIVE_INFINITY
  }

  return proposedEvents.reduce((total, event, index) => {
    const original = originalEvents[index]
    if (!original || original.type !== event.type) {
      return Number.POSITIVE_INFINITY
    }

    const originalTime = new Date(original.occurredAt).getTime()
    const proposedTime = new Date(event.occurredAt).getTime()
    const deltaMinutes = Math.abs(proposedTime - originalTime) / 60_000

    return total + deltaMinutes
  }, 0)
}

function firstEventTime(events: ProposedClockEvent[], type: ClockEventType) {
  const event = events.find((item) => item.type === type)
  return event ? localTime(event.occurredAt) : undefined
}

function eventLabel(
  type: ClockEventType,
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  return t(
    {
      'clock-in': 'todayUi.clockIn',
      'start-break': 'todayUi.startBreak',
      'resume-work': 'todayUi.resumeWork',
      'clock-out': 'todayUi.clockOut',
    }[type]
  )
}

function stepLabel(
  id: string,
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  if (id === 'manager') return t('settings.account.manager')
  if (id === 'hr') return t('usersUi.hrRole')

  return t('timesheetUi.teamLead')
}

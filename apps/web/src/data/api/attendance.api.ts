import {
  parseApiTimeBookingDto,
  type ApiBookingSource,
  type ApiTimeBookingDto,
  type ApiTimeBookingType,
  type ApiWorkLocation,
} from '@/contracts/api'
import { AttendanceCommandError } from '@/domain/attendance/commands'
import type {
  ClockEvent,
  ClockEventDevice,
  ClockEventGeo,
  ClockEventSource,
  ClockEventType,
  AttendanceCommandErrorCode,
  WorkLocation,
} from '@/domain/attendance/types'
import { FlowProApiError, flowProApi } from './http-client'

type ApiAttendanceCommandResult = {
  booking: ApiTimeBookingDto
  isReplay: boolean
}

type ApiAttendanceEventPage = {
  items: ApiTimeBookingDto[]
}

type ClockCommandInput = {
  clientEmployeeId: string
  device?: ClockEventDevice
  geo?: ClockEventGeo
  location?: WorkLocation
  type: ClockEventType
}

type ManualBookingInput = {
  clientEmployeeId: string
  geo?: ClockEventGeo
  location?: WorkLocation
  occurredAt: Date
  reason: string
  type: ClockEventType
}

export async function listMyAttendanceEvents({
  clientEmployeeId,
  fromInclusive,
  toExclusive,
}: {
  clientEmployeeId: string
  fromInclusive: Date
  toExclusive: Date
}) {
  const response = await flowProApi.get<ApiAttendanceEventPage>(
    '/attendance/me/events',
    {
      params: {
        from: fromInclusive.toISOString(),
        to: toExclusive.toISOString(),
      },
    }
  )

  return response.data.items.map((booking) =>
    mapBooking(parseApiTimeBookingDto(booking), clientEmployeeId)
  )
}

export async function executeClockCommand(
  input: ClockCommandInput,
  idempotencyKey?: string
) {
  try {
    const response = await flowProApi.post<ApiAttendanceCommandResult>(
      `/attendance/commands/${input.type}`,
      {
        accuracyMeters: input.geo?.accuracy,
        deviceId: input.device?.label,
        latitude: input.geo?.latitude,
        location: mapLocationToApi(input.location),
        longitude: input.geo?.longitude,
      },
      { headers: idempotencyHeaders(idempotencyKey) }
    )

    return mapBooking(
      parseApiTimeBookingDto(response.data.booking),
      input.clientEmployeeId
    )
  } catch (error) {
    throw mapCommandError(error)
  }
}

export async function createManualBooking(input: ManualBookingInput) {
  const response = await flowProApi.post<ApiAttendanceCommandResult>(
    '/attendance/commands/manual-booking',
    {
      accuracyMeters: input.geo?.accuracy,
      latitude: input.geo?.latitude,
      location: mapLocationToApi(input.location),
      longitude: input.geo?.longitude,
      occurredAt: input.occurredAt.toISOString(),
      reason: input.reason,
      type: mapTypeToApi(input.type),
    },
    { headers: idempotencyHeaders() }
  )

  return mapBooking(
    parseApiTimeBookingDto(response.data.booking),
    input.clientEmployeeId
  )
}

export async function correctAttendanceBooking({
  event,
  reason,
}: {
  event: ClockEvent
  reason: string
}) {
  const response = await flowProApi.post<ApiAttendanceCommandResult>(
    `/attendance/bookings/${event.id}/corrections`,
    {
      accuracyMeters: event.geo?.accuracy,
      latitude: event.geo?.latitude,
      location: mapLocationToApi(event.location),
      longitude: event.geo?.longitude,
      occurredAt: event.occurredAt,
      reason,
      type: mapTypeToApi(event.type),
    },
    { headers: idempotencyHeaders() }
  )

  return mapBooking(
    parseApiTimeBookingDto(response.data.booking),
    event.employeeId
  )
}

export async function voidAttendanceBooking({
  event,
  reason,
}: {
  event: ClockEvent
  reason: string
}) {
  await flowProApi.post(
    `/attendance/bookings/${event.id}/void`,
    { reason },
    { headers: idempotencyHeaders() }
  )
}

function mapBooking(
  booking: ApiTimeBookingDto,
  clientEmployeeId: string
): ClockEvent {
  return {
    id: booking.id,
    employeeId: clientEmployeeId,
    type: mapTypeFromApi(booking.type),
    occurredAt: booking.occurredAt,
    location: mapLocationFromApi(booking.location),
    source: mapSourceFromApi(booking.source),
    device: mapDevice(booking),
    geo:
      booking.latitude == null || booking.longitude == null
        ? undefined
        : {
            accuracy: booking.accuracyMeters ?? undefined,
            latitude: booking.latitude,
            longitude: booking.longitude,
          },
    syncState: 'synced',
  }
}

function mapDevice(booking: ApiTimeBookingDto): ClockEventDevice | undefined {
  if (!booking.deviceId) return undefined

  return {
    label: booking.deviceId,
    type:
      booking.source === 'terminal'
        ? 'terminal'
        : booking.source === 'mobile'
          ? 'mobile'
          : 'browser',
  }
}

function mapSourceFromApi(source: ApiBookingSource): ClockEventSource {
  if (source === 'manual') return 'manual'
  if (source === 'terminal') return 'terminal'
  if (source === 'system') return 'system'
  return 'user'
}

function mapTypeFromApi(type: ApiTimeBookingType): ClockEventType {
  if (type === 'clockIn') return 'clock-in'
  if (type === 'startBreak') return 'start-break'
  if (type === 'resumeWork') return 'resume-work'
  return 'clock-out'
}

function mapTypeToApi(type: ClockEventType): ApiTimeBookingType {
  if (type === 'clock-in') return 'clockIn'
  if (type === 'start-break') return 'startBreak'
  if (type === 'resume-work') return 'resumeWork'
  return 'clockOut'
}

function mapLocationFromApi(
  location?: ApiWorkLocation | null
): WorkLocation | undefined {
  return location === 'homeOffice'
    ? 'home-office'
    : location === 'office'
      ? 'office'
      : undefined
}

function mapLocationToApi(
  location?: WorkLocation
): ApiWorkLocation | undefined {
  return location === 'home-office'
    ? 'homeOffice'
    : location === 'office'
      ? 'office'
      : undefined
}

function idempotencyHeaders(explicitKey?: string) {
  if (explicitKey) {
    return { 'Idempotency-Key': explicitKey }
  }

  const id =
    typeof globalThis.crypto !== 'undefined' &&
    'randomUUID' in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  return { 'Idempotency-Key': `web-${id}` }
}

function mapCommandError(error: unknown) {
  if (!(error instanceof FlowProApiError)) return error

  const code = error.code.replace(/^attendance\./, '')
  const commandCodes: AttendanceCommandErrorCode[] = [
    'clock-in.invalid-state',
    'start-break.invalid-state',
    'resume-work.invalid-state',
    'clock-out.invalid-state',
  ]

  return commandCodes.includes(code as AttendanceCommandErrorCode)
    ? new AttendanceCommandError(code as AttendanceCommandErrorCode)
    : error
}

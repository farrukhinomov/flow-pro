import { isSameDay, parseISO } from 'date-fns'
import {
  createAttendancePolicyUpsertOperation,
  createAttendanceTypeDeleteOperation,
  createAttendanceTypeUpsertOperation,
  createClockEventDeleteOperation,
  createClockEventUpdateOperation,
} from '@/domain/attendance/commands'
import {
  getDefaultAttendancePolicyConfig,
  getDefaultAttendanceTypes,
} from '@/domain/attendance/policies'
import type {
  AppliedTimeCorrection,
  AttendancePolicyConfig,
  AttendanceStatusType,
  ClockEvent,
  OutboxOperation,
  SyncMeta,
} from '@/domain/attendance/types'
import { appendAuditEvent } from './audit.repo'
import {
  deleteFromStore,
  getAllFromStore,
  getFromStore,
  putInStore,
  putManyInStore,
  replaceManyInStore,
} from './db'

const SYNC_META_KEY = 'attendance-sync'

/**
 * Product defaults, not demo data.
 *
 * Every workspace needs an attendance type catalogue to function offline, so
 * unlike the fixtures in `src/demo` these apply in production too. Named
 * "defaults" rather than "seeded" because sharing the seeding vocabulary is
 * what blurred the line between the two in the first place.
 */
async function applyDefaultAttendanceTypes() {
  const current = await getAllFromStore<AttendanceStatusType>('attendanceTypes')

  if (current.length > 0) return

  await putManyInStore('attendanceTypes', getDefaultAttendanceTypes())
}

async function applyDefaultAttendancePolicyConfig() {
  const current = await getFromStore<AttendancePolicyConfig>(
    'attendancePolicyConfigs',
    'default'
  )

  if (current) return

  await putInStore(
    'attendancePolicyConfigs',
    getDefaultAttendancePolicyConfig()
  )
}

export async function listAttendanceTypes() {
  await applyDefaultAttendanceTypes()

  const types = await getAllFromStore<AttendanceStatusType>('attendanceTypes')

  return types.sort((a, b) => a.code.localeCompare(b.code))
}

export async function getAttendancePolicyConfig() {
  await applyDefaultAttendancePolicyConfig()

  const config = await getFromStore<AttendancePolicyConfig>(
    'attendancePolicyConfigs',
    'default'
  )
  const defaultConfig = getDefaultAttendancePolicyConfig(
    config?.updatedAt ?? new Date().toISOString()
  )

  if (!config) return defaultConfig

  return {
    ...defaultConfig,
    ...config,
    vacationCarryover: {
      ...defaultConfig.vacationCarryover,
      ...config.vacationCarryover,
    },
    periodWindows: {
      ...defaultConfig.periodWindows,
      ...config.periodWindows,
      timesheet: {
        ...defaultConfig.periodWindows.timesheet,
        ...config.periodWindows?.timesheet,
      },
      reports: {
        ...defaultConfig.periodWindows.reports,
        ...config.periodWindows?.reports,
      },
      planning: {
        ...defaultConfig.periodWindows.planning,
        ...config.periodWindows?.planning,
      },
    },
    approvalRules: {
      ...defaultConfig.approvalRules,
      ...config.approvalRules,
    },
  }
}

export async function cacheAttendancePolicyConfig(
  config: AttendancePolicyConfig
) {
  await putInStore('attendancePolicyConfigs', config)
}

export async function upsertAttendancePolicyConfig(
  config: AttendancePolicyConfig
) {
  const nextConfig: AttendancePolicyConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  }

  await putInStore('attendancePolicyConfigs', nextConfig)
  await appendAuditEvent({
    id: `audit-policy-${nextConfig.id}-${nextConfig.updatedAt}`,
    aggregate: 'attendance-policy',
    aggregateId: nextConfig.id,
    action: 'attendance-policy.updated',
    actorId: 'local-session',
    actorName: 'Local session',
    classification: 'personal-data',
    createdAt: nextConfig.updatedAt,
    metadata: {
      countryCode: nextConfig.countryCode,
      periodWindows: nextConfig.periodWindows,
      regionCode: nextConfig.regionCode,
      sicknessPrivacyMode: nextConfig.sicknessPrivacyMode,
      vacationAnnualDays: nextConfig.vacationAnnualDays,
    },
    summary: 'Attendance policy rules were updated.',
  })
  await enqueueOutbox(createAttendancePolicyUpsertOperation(nextConfig))

  return nextConfig
}

export async function upsertAttendanceType(type: AttendanceStatusType) {
  await putInStore('attendanceTypes', type)
  await appendAuditEvent({
    id: `audit-attendance-type-${type.id}-${type.updatedAt}`,
    aggregate: 'attendance-type',
    aggregateId: type.id,
    action: 'attendance-type.upserted',
    actorId: 'local-session',
    actorName: 'Local session',
    classification: type.category === 'sickness' ? 'sensitive' : 'system',
    createdAt: type.updatedAt,
    metadata: {
      auditRequired: type.auditRequired,
      category: type.category,
      code: type.code,
      adminVisibility: type.adminVisibility,
      managerVisibility: type.managerVisibility,
      teammateVisibility: type.teammateVisibility,
    },
    summary: `${type.code} ${type.label} status type was saved.`,
  })
  await enqueueOutbox(createAttendanceTypeUpsertOperation(type))
}

export async function removeAttendanceType(id: string) {
  const current = await getFromStore<AttendanceStatusType>(
    'attendanceTypes',
    id
  )

  await deleteFromStore('attendanceTypes', id)
  await appendAuditEvent({
    id: `audit-attendance-type-${id}-deleted-${Date.now()}`,
    aggregate: 'attendance-type',
    aggregateId: id,
    action: 'attendance-type.deleted',
    actorId: 'local-session',
    actorName: 'Local session',
    classification: current?.category === 'sickness' ? 'sensitive' : 'system',
    createdAt: new Date().toISOString(),
    metadata: {
      code: current?.code,
      label: current?.label,
    },
    summary: `${current?.code ?? id} status type was removed from active policy.`,
  })
  await enqueueOutbox(createAttendanceTypeDeleteOperation(id))
}

export async function listClockEventsForDay(employeeId: string, day: Date) {
  const events = await getAllFromStore<ClockEvent>('clockEvents')

  return events
    .filter(
      (event) =>
        event.employeeId === employeeId &&
        isSameDay(parseISO(event.occurredAt), day)
    )
    .sort(
      (a, b) =>
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    )
}

export async function listClockEventsForEmployee(employeeId: string) {
  const events = await getAllFromStore<ClockEvent>('clockEvents')

  return events
    .filter((event) => event.employeeId === employeeId)
    .sort(
      (a, b) =>
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    )
}

export async function listClockEventsForRange(
  employeeId: string,
  fromInclusive: Date,
  toExclusive: Date
) {
  const events = await getAllFromStore<ClockEvent>('clockEvents')
  const fromTime = fromInclusive.getTime()
  const toTime = toExclusive.getTime()

  return events
    .filter((event) => {
      const occurredAt = new Date(event.occurredAt).getTime()

      return (
        event.employeeId === employeeId &&
        occurredAt >= fromTime &&
        occurredAt < toTime
      )
    })
    .sort(
      (a, b) =>
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    )
}

export async function replaceClockEventsForRange(
  employeeId: string,
  fromInclusive: Date,
  toExclusive: Date,
  events: ClockEvent[]
) {
  const fromTime = fromInclusive.getTime()
  const toTime = toExclusive.getTime()

  await replaceManyInStore<ClockEvent>(
    'clockEvents',
    (event) => {
      const occurredAt = new Date(event.occurredAt).getTime()

      return (
        event.employeeId === employeeId &&
        occurredAt >= fromTime &&
        occurredAt < toTime
      )
    },
    events
  )
}

export async function removeClockEventFromCache(id: string) {
  await deleteFromStore('clockEvents', id)
}

export async function listAllClockEvents() {
  const events = await getAllFromStore<ClockEvent>('clockEvents')

  return events.sort(
    (a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  )
}

export async function addClockEvent(
  event: ClockEvent,
  operation: OutboxOperation
) {
  await putInStore('clockEvents', event)
  await enqueueOutbox(operation)
}

export async function updateClockEvent(event: ClockEvent) {
  await putInStore('clockEvents', event)
}

export async function updateClockEventWithSync(event: ClockEvent) {
  const nextEvent: ClockEvent = {
    ...event,
    syncState: 'pending',
  }

  await putInStore('clockEvents', nextEvent)
  await enqueueOutbox(createClockEventUpdateOperation(nextEvent))
}

export async function removeClockEventWithSync(event: ClockEvent) {
  await deleteFromStore('clockEvents', event.id)
  await appendAuditEvent({
    id: `audit-clock-event-${event.id}-deleted-${Date.now()}`,
    aggregate: 'clock-event',
    aggregateId: event.id,
    action: 'clock-event.deleted',
    actorId: event.employeeId,
    actorName: 'Current user',
    classification: 'personal-data',
    createdAt: new Date().toISOString(),
    metadata: {
      occurredAt: event.occurredAt,
      source: event.source,
      type: event.type,
    },
    summary: `${event.type.replace('-', ' ')} booking was removed from the local timeline.`,
  })
  await enqueueOutbox(createClockEventDeleteOperation(event))
}

export async function listTimeCorrectionsForEmployee(employeeId: string) {
  const corrections =
    await getAllFromStore<AppliedTimeCorrection>('timeCorrections')

  return corrections
    .filter((correction) => correction.employeeId === employeeId)
    .sort(
      (a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime() ||
        new Date(a.approvedAt).getTime() - new Date(b.approvedAt).getTime()
    )
}

export async function upsertTimeCorrection(correction: AppliedTimeCorrection) {
  await putInStore('timeCorrections', correction)
}

export async function enqueueOutbox(operation: OutboxOperation) {
  await putInStore('outbox', operation)
  await refreshSyncMeta()
}

export async function listOutboxOperations() {
  const operations = await getAllFromStore<OutboxOperation>('outbox')

  return operations.sort(
    (a, b) =>
      new Date(a.clientCreatedAt).getTime() -
      new Date(b.clientCreatedAt).getTime()
  )
}

export async function updateOutboxOperation(operation: OutboxOperation) {
  await putInStore('outbox', operation)
  await refreshSyncMeta()
}

export async function getSyncMeta() {
  const current = await getFromStore<SyncMeta>('syncMeta', SYNC_META_KEY)

  if (current) return current

  const pendingCount = await getPendingCount()
  const initial: SyncMeta = {
    key: SYNC_META_KEY,
    isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
    pendingCount,
  }

  await putInStore('syncMeta', initial)

  return initial
}

export async function setSyncMeta(meta: SyncMeta) {
  await putInStore('syncMeta', meta)
}

export async function refreshSyncMeta(partial?: Partial<SyncMeta>) {
  const current = await getSyncMeta()
  const pendingCount = await getPendingCount()
  const next: SyncMeta = {
    ...current,
    ...partial,
    pendingCount,
    isOnline:
      partial?.isOnline ??
      (typeof navigator === 'undefined' ? current.isOnline : navigator.onLine),
  }

  await setSyncMeta(next)

  return next
}

async function getPendingCount() {
  const operations = await getAllFromStore<OutboxOperation>('outbox')

  return operations.filter(
    (operation) =>
      operation.status === 'pending' ||
      operation.status === 'syncing' ||
      operation.status === 'failed' ||
      operation.status === 'conflict'
  ).length
}

import type { OutboxOperation } from '@/domain/attendance/types'

/**
 * Copy for a queued sync operation.
 *
 * Extracted from `sync-status-popover.tsx` because these are pure mappings from
 * an operation to a message key, with no rendering, and they describe the
 * highest-stakes queue in the product. Keeping them separate makes them
 * testable and keeps the popover focused on layout.
 */
type Translate = (key: string, vars?: Record<string, string | number>) => string

export function operationTitle(operation: OutboxOperation, t: Translate) {
  const titleKeys: Partial<Record<OutboxOperation['type'], string>> = {
    'clock-event.create': 'syncUi.operationTitles.clockEventCreate',
    'clock-event.update': 'syncUi.operationTitles.clockEventUpdate',
    'clock-event.delete': 'syncUi.operationTitles.clockEventDelete',
    'request.submit': 'syncUi.operationTitles.requestSubmit',
    'request.approve': 'syncUi.operationTitles.requestApprove',
    'request.reject': 'syncUi.operationTitles.requestReject',
    'request.cancel': 'syncUi.operationTitles.requestCancel',
    'timesheet.sign': 'syncUi.operationTitles.timesheetSign',
    'timesheet.export': 'syncUi.operationTitles.timesheetExport',
    'user.invite': 'syncUi.operationTitles.userInvite',
    'user.upsert': 'syncUi.operationTitles.userUpdate',
    'user.deactivate': 'syncUi.operationTitles.userDeactivate',
    'user.reactivate': 'syncUi.operationTitles.userReactivate',
  }
  const titleKey = titleKeys[operation.type] ?? 'syncUi.operationTitles.default'

  return t(titleKey, { type: operation.type })
}

export function operationDescription(operation: OutboxOperation, t: Translate) {
  if (operation.status === 'failed') {
    return t('syncUi.operationDescriptions.failed')
  }

  if (operation.status === 'conflict') {
    return t('syncUi.operationDescriptions.conflict')
  }

  if (operation.status === 'syncing') {
    return t('syncUi.operationDescriptions.syncing')
  }

  return t('syncUi.operationDescriptions.pending')
}

export function operationStatusLabel(
  status: OutboxOperation['status'],
  t: Translate
) {
  return t(`syncUi.operationStatuses.${status}`)
}

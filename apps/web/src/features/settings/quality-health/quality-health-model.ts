import { projectionHydrationModules } from '@/application/application-store-hydration'
import type { OperationsHealth } from '@/data/api/operations-health.api'
import type { QualityBugRecord } from '@/data/local/quality-bugs.repo'
import type { OutboxOperation, SyncMeta } from '@/domain/attendance/types'

export type QualityHealthSeverity = 'ok' | 'warning' | 'critical'

export type QualityHealthIssue = {
  id: string
  severity: Exclude<QualityHealthSeverity, 'ok'>
  titleKey: string
  descriptionKey: string
}

export type QualityHealthSummary = {
  auditIntegritySeverity: QualityHealthSeverity
  bugSlaSeverity: QualityHealthSeverity
  bugDashboard: QualityBugDashboard
  failedOutboxCount: number
  highSeveritySlaHours: number
  normalSeveritySlaDays: number
  openIssueCount: number
  pendingOutboxCount: number
  projectionErrorCount: number
  score: number
  serverHealthStatus: QualityHealthSeverity
  severity: QualityHealthSeverity
}

export type QualityBugDashboard = {
  highSeverityCount: number
  normalSeverityCount: number
  oldestOpenAgeDays: number
  openBugCount: number
  productAreas: string[]
  severity: QualityHealthSeverity
}

export function buildQualityHealthSummary({
  auditIntegrityValid,
  operations,
  operationsHealth,
  operationsHealthError,
  qualityBugs = [],
  syncMeta,
}: {
  auditIntegrityValid: boolean
  operations: OutboxOperation[]
  operationsHealth: OperationsHealth | null
  operationsHealthError?: string
  qualityBugs?: QualityBugRecord[]
  syncMeta: SyncMeta | null
}) {
  const failedOutboxCount = operations.filter(
    (operation) => operation.status === 'failed'
  ).length
  const pendingOutboxCount =
    syncMeta?.pendingCount ??
    operations.filter((operation) =>
      ['pending', 'syncing', 'failed', 'conflict'].includes(operation.status)
    ).length
  const projectionErrorCount = projectionHydrationModules.filter(
    (module) => !!syncMeta?.projectionHydration?.[module]?.lastError
  ).length
  const issues = buildQualityHealthIssues({
    auditIntegrityValid,
    failedOutboxCount,
    operationsHealth,
    operationsHealthError,
    pendingOutboxCount,
    projectionErrorCount,
    syncMeta,
  })
  const criticalCount = issues.filter(
    (issue) => issue.severity === 'critical'
  ).length
  const warningCount = issues.filter(
    (issue) => issue.severity === 'warning'
  ).length
  const score = Math.max(0, 100 - criticalCount * 30 - warningCount * 12)
  const bugDashboard = buildQualityBugDashboard({
    bugs: qualityBugs,
    issues,
  })

  return {
    auditIntegritySeverity: auditIntegrityValid ? 'ok' : 'critical',
    bugDashboard,
    bugSlaSeverity: bugDashboard.severity,
    failedOutboxCount,
    highSeveritySlaHours: 48,
    normalSeveritySlaDays: 7,
    openIssueCount: issues.length,
    pendingOutboxCount,
    projectionErrorCount,
    score,
    serverHealthStatus:
      operationsHealth?.status ?? (operationsHealthError ? 'warning' : 'ok'),
    severity:
      criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'ok',
  } satisfies QualityHealthSummary
}

export function buildQualityBugDashboard({
  bugs = [],
  issues,
  now = new Date(),
}: {
  bugs?: readonly QualityBugRecord[]
  issues: readonly QualityHealthIssue[]
  now?: Date
}): QualityBugDashboard {
  if (bugs.length > 0) {
    const highSeverityCount = bugs.filter(
      (bug) => bug.severity === 'high'
    ).length
    const normalSeverityCount = bugs.filter(
      (bug) => bug.severity === 'normal'
    ).length
    const oldestOpenAgeDays = Math.max(
      0,
      ...bugs.map((bug) => differenceInDays(now, new Date(bug.createdAt)))
    )

    return {
      highSeverityCount,
      normalSeverityCount,
      oldestOpenAgeDays,
      openBugCount: bugs.length,
      productAreas: Array.from(
        new Set(bugs.map((bug) => bug.productArea))
      ).sort(),
      severity:
        highSeverityCount > 0
          ? 'critical'
          : normalSeverityCount > 0
            ? 'warning'
            : 'ok',
    }
  }

  const highSeverityCount = issues.filter(
    (issue) => issue.severity === 'critical'
  ).length
  const normalSeverityCount = issues.filter(
    (issue) => issue.severity === 'warning'
  ).length
  const productAreas = Array.from(
    new Set(issues.map((issue) => getBugProductArea(issue.id)))
  ).sort()

  return {
    highSeverityCount,
    normalSeverityCount,
    oldestOpenAgeDays: 0,
    openBugCount: issues.length,
    productAreas,
    severity:
      highSeverityCount > 0
        ? 'critical'
        : normalSeverityCount > 0
          ? 'warning'
          : 'ok',
  }
}

function differenceInDays(left: Date, right: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000

  return Math.floor((left.getTime() - right.getTime()) / millisecondsPerDay)
}

export function buildQualityHealthIssues({
  auditIntegrityValid,
  failedOutboxCount,
  operationsHealth,
  operationsHealthError,
  pendingOutboxCount,
  projectionErrorCount,
  syncMeta,
}: {
  auditIntegrityValid: boolean
  failedOutboxCount: number
  operationsHealth: OperationsHealth | null
  operationsHealthError?: string
  pendingOutboxCount: number
  projectionErrorCount: number
  syncMeta: SyncMeta | null
}) {
  const issues: QualityHealthIssue[] = []

  if (!auditIntegrityValid) {
    issues.push({
      id: 'audit-integrity',
      severity: 'critical',
      titleKey: 'qualityHealthUi.issues.auditIntegrity.title',
      descriptionKey: 'qualityHealthUi.issues.auditIntegrity.description',
    })
  }

  if (syncMeta?.isOnline === false) {
    issues.push({
      id: 'offline',
      severity: 'warning',
      titleKey: 'qualityHealthUi.issues.offline.title',
      descriptionKey: 'qualityHealthUi.issues.offline.description',
    })
  }

  if (failedOutboxCount > 0) {
    issues.push({
      id: 'failed-outbox',
      severity: 'critical',
      titleKey: 'qualityHealthUi.issues.failedOutbox.title',
      descriptionKey: 'qualityHealthUi.issues.failedOutbox.description',
    })
  }

  if (pendingOutboxCount > 0) {
    issues.push({
      id: 'pending-outbox',
      severity: failedOutboxCount > 0 ? 'critical' : 'warning',
      titleKey: 'qualityHealthUi.issues.pendingOutbox.title',
      descriptionKey: 'qualityHealthUi.issues.pendingOutbox.description',
    })
  }

  if (projectionErrorCount > 0) {
    issues.push({
      id: 'projection-errors',
      severity: 'critical',
      titleKey: 'qualityHealthUi.issues.projectionErrors.title',
      descriptionKey: 'qualityHealthUi.issues.projectionErrors.description',
    })
  }

  if (syncMeta?.lastError) {
    issues.push({
      id: 'sync-error',
      severity: 'critical',
      titleKey: 'qualityHealthUi.issues.syncError.title',
      descriptionKey: 'qualityHealthUi.issues.syncError.description',
    })
  }

  if (operationsHealth?.status === 'critical') {
    issues.push({
      id: 'server-health-critical',
      severity: 'critical',
      titleKey: 'qualityHealthUi.issues.serverHealthCritical.title',
      descriptionKey: 'qualityHealthUi.issues.serverHealthCritical.description',
    })
  } else if (operationsHealth?.status === 'warning') {
    issues.push({
      id: 'server-health-warning',
      severity: 'warning',
      titleKey: 'qualityHealthUi.issues.serverHealthWarning.title',
      descriptionKey: 'qualityHealthUi.issues.serverHealthWarning.description',
    })
  } else if (operationsHealthError) {
    issues.push({
      id: 'server-health-unavailable',
      severity: 'warning',
      titleKey: 'qualityHealthUi.issues.serverHealthUnavailable.title',
      descriptionKey:
        'qualityHealthUi.issues.serverHealthUnavailable.description',
    })
  }

  return issues
}

function getBugProductArea(issueId: string) {
  if (issueId.includes('audit')) return 'Audit'
  if (issueId.includes('outbox')) return 'Sync and local cache'
  if (issueId.includes('projection')) return 'Sync and local cache'
  if (issueId.includes('server')) return 'Deployment and operations'
  if (issueId.includes('sync')) return 'Sync and local cache'
  if (issueId === 'offline') return 'Deployment and operations'

  return 'Operations'
}

import { useEffect, useMemo, useState } from 'react'
import { resolveApiErrorMessage } from '@/data/api/api-error'
import {
  getOperationsHealthWorkflow,
  shouldFallbackToLocalOperationsHealth,
  type OperationsHealth,
} from '@/data/api/operations-health.api'
import { listAuditEvents } from '@/data/local/audit.repo'
import {
  listOpenQualityBugs,
  type QualityBugRecord,
} from '@/data/local/quality-bugs.repo'
import { verifyAuditTrail } from '@/domain/audit/audit'
import type { AuditEvent } from '@/domain/requests/types'
import { useI18n, type Locale } from '@/i18n'
import { formatRelativeTime } from '@/i18n/format'
import {
  AlertTriangle,
  BadgeCheck,
  Bug,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  GanttChartSquare,
  Loader2,
  ShieldAlert,
  Siren,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSyncStatus } from '@/features/sync/use-sync-status'
import { ContentSection } from '../components/content-section'
import {
  buildQualityHealthIssues,
  buildQualityHealthSummary,
  type QualityHealthSeverity,
} from './quality-health-model'

export function SettingsQualityHealth() {
  const { locale, t } = useI18n()
  const { failedOperations, isLoading, migrationStatus, operations, syncMeta } =
    useSyncStatus()
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [isAuditLoading, setIsAuditLoading] = useState(true)
  const [operationsHealth, setOperationsHealth] =
    useState<OperationsHealth | null>(null)
  const [operationsHealthError, setOperationsHealthError] = useState<
    string | undefined
  >()
  const [isOperationsHealthLoading, setIsOperationsHealthLoading] =
    useState(true)
  const [qualityBugs, setQualityBugs] = useState<QualityBugRecord[]>([])

  useEffect(() => {
    let isMounted = true

    void listAuditEvents()
      .then((events) => {
        if (isMounted) setAuditEvents(events)
      })
      .finally(() => {
        if (isMounted) setIsAuditLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    void listOpenQualityBugs().then((bugs) => {
      if (isMounted) setQualityBugs(bugs)
    })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    void getOperationsHealthWorkflow()
      .then((health) => {
        if (!isMounted) return
        setOperationsHealth(health)
        setOperationsHealthError(undefined)
      })
      .catch((error: unknown) => {
        if (!isMounted || !shouldFallbackToLocalOperationsHealth(error)) return
        setOperationsHealth(null)
        setOperationsHealthError(
          resolveApiErrorMessage(
            error,
            t,
            'qualityHealthUi.operationsHealthUnavailable'
          )
        )
      })
      .finally(() => {
        if (isMounted) setIsOperationsHealthLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [t])

  const auditIntegrity = useMemo(
    () => verifyAuditTrail(auditEvents),
    [auditEvents]
  )
  const summary = useMemo(
    () =>
      buildQualityHealthSummary({
        auditIntegrityValid: auditIntegrity.isValid,
        operations,
        operationsHealth,
        operationsHealthError,
        qualityBugs,
        syncMeta,
      }),
    [
      auditIntegrity.isValid,
      operations,
      operationsHealth,
      operationsHealthError,
      qualityBugs,
      syncMeta,
    ]
  )
  const issues = useMemo(
    () =>
      buildQualityHealthIssues({
        auditIntegrityValid: auditIntegrity.isValid,
        failedOutboxCount: summary.failedOutboxCount,
        operationsHealth,
        operationsHealthError,
        pendingOutboxCount: summary.pendingOutboxCount,
        projectionErrorCount: summary.projectionErrorCount,
        syncMeta,
      }),
    [
      auditIntegrity.isValid,
      summary.failedOutboxCount,
      operationsHealth,
      operationsHealthError,
      summary.pendingOutboxCount,
      summary.projectionErrorCount,
      syncMeta,
    ]
  )
  const newestFailedOperation = failedOperations[0]

  return (
    <ContentSection
      title={t('qualityHealthUi.title')}
      desc={t('qualityHealthUi.description')}
    >
      <div className='space-y-4'>
        {summary.severity !== 'ok' && (
          <Alert>
            <AlertTriangle className='h-4 w-4' />
            <AlertTitle>{t('qualityHealthUi.attentionRequired')}</AlertTitle>
            <AlertDescription>
              {t('qualityHealthUi.attentionRequiredDescription')}
            </AlertDescription>
          </Alert>
        )}

        <div className='grid gap-3 md:grid-cols-2'>
          <ScoreCard
            isLoading={isLoading || isAuditLoading}
            score={summary.score}
            severity={summary.severity}
          />
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <Bug className='h-4 w-4 text-muted-foreground' />
                {t('qualityHealthUi.bugDashboard')}
              </CardTitle>
              <CardDescription>
                {t('qualityHealthUi.bugDashboardDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className='grid gap-2 text-sm sm:grid-cols-2'>
              <SlaTile
                label={t('qualityHealthUi.openBugs')}
                value={String(summary.bugDashboard.openBugCount)}
              />
              <SlaTile
                label={t('qualityHealthUi.highSeverityBugs')}
                value={String(summary.bugDashboard.highSeverityCount)}
              />
              <SlaTile
                label={t('qualityHealthUi.normalSeverityBugs')}
                value={String(summary.bugDashboard.normalSeverityCount)}
              />
              <SlaTile
                label={t('qualityHealthUi.oldestOpenBug')}
                value={t('qualityHealthUi.days', {
                  count: String(summary.bugDashboard.oldestOpenAgeDays),
                })}
              />
              <SlaTile
                label={t('qualityHealthUi.productAreas')}
                value={
                  summary.bugDashboard.productAreas.length > 0
                    ? summary.bugDashboard.productAreas.join(', ')
                    : t('qualityHealthUi.none')
                }
              />
              <SlaTile
                label={t('qualityHealthUi.highSeverity')}
                value={t('qualityHealthUi.hours', {
                  count: String(summary.highSeveritySlaHours),
                })}
              />
              <SlaTile
                label={t('qualityHealthUi.normalSeverity')}
                value={t('qualityHealthUi.days', {
                  count: String(summary.normalSeveritySlaDays),
                })}
              />
            </CardContent>
          </Card>
        </div>

        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
          <HealthMetric
            icon={ClipboardCheck}
            label={t('qualityHealthUi.openRisks')}
            severity={summary.severity}
            value={summary.openIssueCount}
          />
          <HealthMetric
            icon={DatabaseZap}
            label={t('qualityHealthUi.failedOutbox')}
            severity={summary.failedOutboxCount > 0 ? 'critical' : 'ok'}
            value={summary.failedOutboxCount}
          />
          <HealthMetric
            icon={DatabaseZap}
            label={t('qualityHealthUi.serverHealth')}
            severity={summary.serverHealthStatus}
            value={
              isOperationsHealthLoading
                ? t('common.loading')
                : operationsHealth
                  ? t(`qualityHealthUi.${operationsHealth.status}`)
                  : t('qualityHealthUi.unavailable')
            }
          />
          <HealthMetric
            icon={GanttChartSquare}
            label={t('qualityHealthUi.projectionFailures')}
            severity={summary.projectionErrorCount > 0 ? 'critical' : 'ok'}
            value={summary.projectionErrorCount}
          />
          <HealthMetric
            icon={ShieldAlert}
            label={t('qualityHealthUi.auditIntegrity')}
            severity={summary.auditIntegritySeverity}
            value={
              auditIntegrity.isValid
                ? t('qualityHealthUi.valid')
                : t('qualityHealthUi.review')
            }
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>
              {t('qualityHealthUi.operationalRisks')}
            </CardTitle>
            <CardDescription>
              {t('qualityHealthUi.operationalRisksDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading || isAuditLoading ? (
              <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                <Loader2 className='h-4 w-4 animate-spin' />
                {t('common.loading')}
              </div>
            ) : issues.length === 0 ? (
              <div className='flex items-center gap-2 rounded-md border bg-muted/20 p-3 text-sm'>
                <CheckCircle2 className='h-4 w-4 text-emerald-600' />
                {t('qualityHealthUi.noOperationalRisks')}
              </div>
            ) : (
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('qualityHealthUi.severity')}</TableHead>
                      <TableHead>{t('qualityHealthUi.risk')}</TableHead>
                      <TableHead>{t('qualityHealthUi.action')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issues.map((issue) => (
                      <TableRow key={issue.id}>
                        <TableCell>
                          <SeverityBadge severity={issue.severity} />
                        </TableCell>
                        <TableCell className='font-medium'>
                          {t(issue.titleKey)}
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {t(issue.descriptionKey)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>
              {t('qualityHealthUi.serverOperations')}
            </CardTitle>
            <CardDescription>
              {t('qualityHealthUi.serverOperationsDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className='grid gap-2 text-sm md:grid-cols-2'>
            <EvidenceRow
              label={t('qualityHealthUi.backendReachability')}
              value={
                isOperationsHealthLoading
                  ? t('common.loading')
                  : operationsHealth
                    ? t('qualityHealthUi.reachable')
                    : t('qualityHealthUi.unavailable')
              }
            />
            <EvidenceRow
              label={t('qualityHealthUi.serverPendingOutbox')}
              value={formatNumber(operationsHealth?.pendingOutboxCount, t)}
            />
            <EvidenceRow
              label={t('qualityHealthUi.serverFailedOutbox')}
              value={formatNumber(operationsHealth?.failedOutboxCount, t)}
            />
            <EvidenceRow
              label={t('qualityHealthUi.lastProcessedOutbox')}
              value={formatLastSeen(
                operationsHealth?.lastProcessedOutboxAt,
                locale,
                t
              )}
            />
            <EvidenceRow
              label={t('qualityHealthUi.lastAuditEvent')}
              value={formatLastSeen(
                operationsHealth?.lastAuditEventAt,
                locale,
                t
              )}
            />
            <EvidenceRow
              label={t('qualityHealthUi.lastProjectionUpdate')}
              value={formatLastSeen(
                operationsHealth?.lastProjectionUpdatedAt,
                locale,
                t
              )}
            />
            <EvidenceRow
              label={t('qualityHealthUi.serverCursor')}
              value={formatNumber(operationsHealth?.clientAggregateCount, t)}
            />
            <EvidenceRow
              label={t('qualityHealthUi.lastServerError')}
              value={
                operationsHealth?.lastOutboxError ??
                operationsHealthError ??
                t('qualityHealthUi.none')
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>
              {t('qualityHealthUi.evidence')}
            </CardTitle>
          </CardHeader>
          <CardContent className='grid gap-2 text-sm md:grid-cols-2'>
            <EvidenceRow
              label={t('qualityHealthUi.lastSuccessfulSync')}
              value={formatLastSeen(syncMeta?.lastSyncedAt, locale, t)}
            />
            <EvidenceRow
              label={t('qualityHealthUi.lastSyncError')}
              value={syncMeta?.lastError ?? t('qualityHealthUi.none')}
            />
            <EvidenceRow
              label={t('qualityHealthUi.localSchema')}
              value={
                migrationStatus
                  ? `${migrationStatus.currentVersion}/${migrationStatus.expectedVersion}`
                  : t('qualityHealthUi.unknown')
              }
            />
            <EvidenceRow
              label={t('qualityHealthUi.newestFailedOutbox')}
              value={
                newestFailedOperation
                  ? `${newestFailedOperation.aggregate}:${newestFailedOperation.aggregateId}`
                  : t('qualityHealthUi.none')
              }
            />
          </CardContent>
        </Card>
      </div>
    </ContentSection>
  )
}

function ScoreCard({
  isLoading,
  score,
  severity,
}: {
  isLoading: boolean
  score: number
  severity: QualityHealthSeverity
}) {
  const { t } = useI18n()

  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          {severity === 'critical' ? (
            <Siren className='h-4 w-4 text-destructive' />
          ) : (
            <BadgeCheck className='h-4 w-4 text-emerald-600' />
          )}
          {t('qualityHealthUi.qualityScore')}
        </CardTitle>
        <CardDescription>
          {t('qualityHealthUi.qualityScoreDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <Loader2 className='h-4 w-4 animate-spin' />
            {t('common.loading')}
          </div>
        ) : (
          <div className='flex items-end gap-2'>
            <span className='text-4xl font-bold tracking-tight'>{score}</span>
            <span className='pb-1 text-sm text-muted-foreground'>/ 100</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function HealthMetric({
  icon: Icon,
  label,
  severity,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  severity: QualityHealthSeverity
  value: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className='flex items-center gap-3 p-4'>
        <Icon className={getIconClassName(severity)} />
        <div className='min-w-0'>
          <div className='text-xs text-muted-foreground'>{label}</div>
          <div className='truncate text-sm font-semibold'>{value}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function SlaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-md border p-3'>
      <div className='text-xs text-muted-foreground'>{label}</div>
      <div className='mt-1 font-semibold'>{value}</div>
    </div>
  )
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex min-w-0 items-center justify-between gap-3 rounded-md border px-3 py-2'>
      <span className='min-w-0 truncate text-muted-foreground'>{label}</span>
      <span className='min-w-0 truncate text-right font-medium'>{value}</span>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: QualityHealthSeverity }) {
  const { t } = useI18n()

  return (
    <Badge variant={severity === 'critical' ? 'destructive' : 'secondary'}>
      {severity === 'critical'
        ? t('qualityHealthUi.critical')
        : severity === 'warning'
          ? t('qualityHealthUi.warning')
          : t('qualityHealthUi.ok')}
    </Badge>
  )
}

function getIconClassName(severity: QualityHealthSeverity) {
  if (severity === 'critical') return 'h-5 w-5 text-destructive'
  if (severity === 'warning') return 'h-5 w-5 text-amber-600'
  return 'h-5 w-5 text-emerald-600'
}

function formatLastSeen(
  value: string | undefined,
  locale: Locale,
  t: (key: string) => string
) {
  if (!value) return t('qualityHealthUi.never')

  return formatRelativeTime(value, locale)
}

function formatNumber(value: number | undefined, t: (key: string) => string) {
  return value === undefined ? t('qualityHealthUi.unknown') : String(value)
}

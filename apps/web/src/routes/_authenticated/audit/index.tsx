import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { listAuditEventsBackendFirst } from '@/data/audit.gateway'
import { recordPrivacyAccessEvent } from '@/data/local/audit.repo'
import { listEmployeeRequests } from '@/data/local/requests.repo'
import { listEmployeeUsers } from '@/data/local/users.repo'
import { listEmployeeUsersBackendFirst } from '@/data/users.gateway'
import { canViewFullAudit } from '@/domain/access/access-control'
import { verifyAuditTrail } from '@/domain/audit/audit'
import {
  createDataSubjectRequest,
  defaultRetentionRules,
  getDefaultConsentRecords,
  type DataSubjectRequest,
} from '@/domain/privacy/gdpr'
import type { AuditEvent } from '@/domain/requests/types'
import type { EmployeeUser } from '@/domain/users/types'
import { useI18n } from '@/i18n'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { buildCsv } from '@/lib/csv'
import { downloadCsvFile, downloadJsonFile } from '@/lib/download'
import { logger } from '@/lib/logger'
import { optionalSource } from '@/lib/optional-source'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { useCurrentViewer } from '@/features/access/use-current-viewer'
import {
  AuditGovernancePanel,
  AuditMetrics,
  AuditTimelineCard,
} from '@/features/audit/components'
import { RouteError } from '@/features/errors/route-error'

export const Route = createFileRoute('/_authenticated/audit/')({
  component: AuditPage,
  errorComponent: RouteError,
})

const ALL = 'all'

function AuditPage() {
  const { t } = useI18n()
  const viewer = useCurrentViewer()
  const hasLoggedView = useRef(false)
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [users, setUsers] = useState<EmployeeUser[]>([])
  const [search, setSearch] = useState('')
  const [aggregateFilter, setAggregateFilter] = useState(ALL)
  const [actorFilter, setActorFilter] = useState(ALL)
  const [classificationFilter, setClassificationFilter] = useState(ALL)
  const [isLoading, setIsLoading] = useState(true)

  const canView = canViewFullAudit(viewer)

  const refresh = useCallback(async () => {
    try {
      await listEmployeeRequests()
      const [nextAuditEvents, nextUsers] = await Promise.all([
        listAuditEventsBackendFirst(),
        // Names the actors; the evidence itself does not depend on it.
        optionalSource(
          listEmployeeUsersBackendFirst(),
          () => listEmployeeUsers(),
          'people'
        ),
      ])

      setAuditEvents(nextAuditEvents)
      setUsers(nextUsers)
    } catch (error) {
      logger.error(error, 'Could not load the audit trail')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => {
      void refresh()
    }, 0)

    return () => window.clearTimeout(initialRefresh)
  }, [refresh])

  useEffect(() => {
    if (!canView || hasLoggedView.current) return

    hasLoggedView.current = true
    void recordPrivacyAccessEvent({
      actorId: viewer.employeeId,
      actorName: viewer.name,
      aggregateId: 'global-audit-log',
      metadata: {
        role: viewer.role,
        scope: 'global-audit-log',
      },
      summary: t('auditUi.openedGlobalPrivacyAuditLog', { name: viewer.name }),
    }).then(() => refresh())
  }, [canView, refresh, t, viewer.employeeId, viewer.name, viewer.role])

  const consentRecords = useMemo(
    () => users.flatMap((user) => getDefaultConsentRecords(user.id)),
    [users]
  )

  const dataSubjectRequests = useMemo<DataSubjectRequest[]>(
    () =>
      users.slice(0, 3).map((user, index) =>
        createDataSubjectRequest({
          employeeId: user.id,
          type:
            index === 0
              ? 'export-data'
              : index === 1
                ? 'rectify-data'
                : 'delete-user-data',
          note:
            index === 2
              ? t('auditUi.deleteAllowedAfterRetentionReview')
              : undefined,
          now: `2026-05-${20 + index}T09:00:00.000Z`,
        })
      ),
    [t, users]
  )

  const aggregates = useMemo(
    () => Array.from(new Set(auditEvents.map((event) => event.aggregate))),
    [auditEvents]
  )

  const actors = useMemo(
    () =>
      Array.from(new Set(auditEvents.map((event) => event.actorName))).sort(),
    [auditEvents]
  )

  const integrity = useMemo(() => verifyAuditTrail(auditEvents), [auditEvents])

  const privacyAccessEvents = auditEvents.filter(
    (event) => event.aggregate === 'privacy-access'
  )

  const filteredAuditEvents = auditEvents.filter((event) => {
    const query =
      `${event.summary} ${event.actorName} ${event.action} ${event.aggregateId}`
        .toLowerCase()
        .includes(search.toLowerCase())

    const aggregateMatches =
      aggregateFilter === ALL || event.aggregate === aggregateFilter

    const actorMatches = actorFilter === ALL || event.actorName === actorFilter

    const classificationMatches =
      classificationFilter === ALL ||
      (event.classification ?? 'system') === classificationFilter

    return query && aggregateMatches && actorMatches && classificationMatches
  })

  const exportAudit = useCallback(
    (formatType: 'json' | 'csv') => {
      const fileName = `flowpro-audit-${new Date()
        .toISOString()
        .slice(0, 10)}.${formatType}`

      if (formatType === 'json') {
        downloadJsonFile(fileName, filteredAuditEvents)
        return
      }

      downloadCsvFile(fileName, toAuditCsv(filteredAuditEvents))
    },
    [filteredAuditEvents]
  )

  return (
    <>
      <Header>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='max-w-full min-w-0 space-y-6 overflow-x-hidden'>
        <div className='flex max-w-full min-w-0 flex-col gap-3 overflow-hidden sm:flex-row sm:items-end sm:justify-between'>
          <div className='max-w-full min-w-0'>
            {/* Page metadata rather than controls; see the same treatment on Reports. */}
            <p className='mb-2 text-xs tracking-wide [overflow-wrap:anywhere] text-muted-foreground uppercase'>
              {[
                t('auditUi.hrAdminRole'),
                t('auditUi.immutableAuditChain'),
                t('auditUi.privacyAccessLog'),
              ].join(' · ')}
            </p>

            <h2 className='text-2xl font-bold tracking-tight [overflow-wrap:anywhere] break-words'>
              {t('auditUi.globalAuditLog')}
            </h2>

            <p className='[overflow-wrap:anywhere] break-words text-muted-foreground'>
              {t('auditUi.globalAuditLogDescription')}
            </p>
          </div>

          <Button asChild variant='outline' className='shrink-0'>
            <Link to='/settings/attendance'>
              <ShieldCheck className='h-4 w-4 shrink-0' />
              <span>{t('auditUi.policySettings')}</span>
            </Link>
          </Button>
        </div>

        {!canView ? (
          <Alert>
            <AlertTriangle className='h-4 w-4' />
            <AlertTitle>{t('auditUi.auditAccessRestricted')}</AlertTitle>
            <AlertDescription>
              {t('auditUi.auditAccessRestrictedDescription')}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <AuditMetrics
              auditEventCount={auditEvents.length}
              consentRecordCount={consentRecords.length}
              dataSubjectRequestCount={dataSubjectRequests.length}
              integrity={integrity}
              isLoading={isLoading}
              privacyAccessEventCount={privacyAccessEvents.length}
            />

            {!integrity.isValid && (
              <Alert>
                <AlertTriangle className='h-4 w-4' />
                <AlertTitle>
                  {t('auditUi.auditIntegrityNeedsReview')}
                </AlertTitle>
                <AlertDescription>
                  {integrity.issues.slice(0, 2).join(' ')}
                </AlertDescription>
              </Alert>
            )}

            {/*
              The two columns hold unrelated content of very different heights, so stretching
              them left the timeline card with a large empty interior whenever few events
              matched. Each column now ends where its content ends.
            */}
            <div className='grid max-w-full min-w-0 items-start gap-6 overflow-hidden xl:grid-cols-[minmax(0,1fr)_minmax(0,390px)]'>
              <AuditTimelineCard
                actorFilter={actorFilter}
                actors={actors}
                aggregateFilter={aggregateFilter}
                aggregates={aggregates}
                classificationFilter={classificationFilter}
                events={filteredAuditEvents}
                isLoading={isLoading}
                onActorFilterChange={setActorFilter}
                onAggregateFilterChange={setAggregateFilter}
                onClassificationFilterChange={setClassificationFilter}
                onExport={exportAudit}
                onResetFilters={() => {
                  setSearch('')
                  setAggregateFilter(ALL)
                  setActorFilter(ALL)
                  setClassificationFilter(ALL)
                }}
                onSearchChange={setSearch}
                search={search}
              />

              <AuditGovernancePanel
                dataSubjectRequests={dataSubjectRequests}
                isLoading={isLoading}
                privacyAccessEvents={privacyAccessEvents}
                retentionRules={defaultRetentionRules}
              />
            </div>
          </>
        )}
      </Main>
    </>
  )
}

function toAuditCsv(events: AuditEvent[]) {
  const rows = events.map((event) => [
    event.createdAt,
    event.actorName,
    event.action,
    event.aggregate,
    event.aggregateId,
    event.classification ?? 'system',
    event.summary,
    event.hash ?? '',
    event.previousHash ?? '',
  ])

  return buildCsv([
    [
      'createdAt',
      'actorName',
      'action',
      'aggregate',
      'aggregateId',
      'classification',
      'summary',
      'hash',
      'previousHash',
    ],
    ...rows,
  ])
}

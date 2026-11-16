import type { ReactNode } from 'react'
import type { verifyAuditTrail } from '@/domain/audit/audit'
import type { DataSubjectRequest } from '@/domain/privacy/gdpr'
import type { AuditEvent } from '@/domain/requests/types'
import { useI18n } from '@/i18n'
import { formatLocaleDate } from '@/i18n/format'
import { Download, FileClock, Search, ShieldCheck, Trash2 } from 'lucide-react'
import { usePaginatedRows } from '@/hooks/use-paginated-rows'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/flowpro/empty-state'
import {
  CardSectionSkeleton,
  MetricCardsSkeleton,
  TableBodySkeletonRows,
} from '@/components/flowpro/loading-skeletons'
import { MetricCard } from '@/components/flowpro/metric-card'
import { RowPagination } from '@/components/flowpro/row-pagination'
import { LiveRegion } from '@/components/live-region'

const ALL = 'all'

export function AuditMetrics({
  auditEventCount,
  consentRecordCount,
  dataSubjectRequestCount,
  integrity,
  isLoading = false,
  privacyAccessEventCount,
}: {
  auditEventCount: number
  consentRecordCount: number
  dataSubjectRequestCount: number
  integrity: ReturnType<typeof verifyAuditTrail>
  isLoading?: boolean
  privacyAccessEventCount: number
}) {
  const { t } = useI18n()
  if (isLoading) {
    return <MetricCardsSkeleton cardCount={5} className='xl:grid-cols-5' />
  }

  return (
    <div className='grid max-w-full min-w-0 gap-3 overflow-hidden sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
      <MetricCard
        title={t('auditUi.auditEvents')}
        value={auditEventCount}
        description={t('auditUi.auditEventsDescription')}
      />
      <MetricCard
        title={t('auditUi.integrity')}
        value={integrity.isValid ? t('auditUi.valid') : t('auditUi.review')}
        numeric={false}
        description={t('auditUi.chainedEventsChecked', {
          count: String(integrity.checkedEvents),
        })}
      />
      <MetricCard
        title={t('auditUi.privacyViews')}
        value={privacyAccessEventCount}
        description={t('auditUi.privacyViewsDescription')}
      />
      <MetricCard
        title={t('auditUi.consentRecords')}
        value={consentRecordCount}
        description={t('auditUi.consentRecordsDescription')}
      />
      <MetricCard
        title={t('auditUi.dataRequests')}
        value={dataSubjectRequestCount}
        description={t('auditUi.dataRequestsDescription')}
      />
    </div>
  )
}

export function AuditTimelineCard({
  actorFilter,
  actors,
  aggregateFilter,
  aggregates,
  classificationFilter,
  events,
  isLoading,
  onActorFilterChange,
  onAggregateFilterChange,
  onClassificationFilterChange,
  onExport,
  onSearchChange,
  onResetFilters,
  search,
}: {
  actorFilter: string
  actors: string[]
  aggregateFilter: string
  aggregates: string[]
  classificationFilter: string
  events: AuditEvent[]
  isLoading: boolean
  onActorFilterChange: (value: string) => void
  onAggregateFilterChange: (value: string) => void
  onClassificationFilterChange: (value: string) => void
  onExport: (formatType: 'json' | 'csv') => void
  onSearchChange: (value: string) => void
  onResetFilters: () => void
  search: string
}) {
  const { locale, t } = useI18n()
  // The audit log only grows, so it is the one table that must never render
  // every row it holds.
  const pagination = usePaginatedRows(events)

  return (
    <Card className='max-w-full min-w-0 overflow-hidden'>
      {/* Typing in the search box silently rewrites the table below it. */}
      <LiveRegion
        message={
          isLoading
            ? ''
            : t('common.resultsAnnouncement', { count: events.length })
        }
      />
      <CardHeader className='space-y-4'>
        <div className='flex max-w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
          <div className='max-w-full min-w-0'>
            <CardTitle className='text-base [overflow-wrap:anywhere] break-words'>
              {t('auditUi.auditTimeline')}
            </CardTitle>
            <CardDescription>
              {t('auditUi.auditTimelineDescription')}
            </CardDescription>
          </div>

          <div className='flex min-w-0 flex-wrap gap-2'>
            <Button variant='outline' size='sm' onClick={() => onExport('csv')}>
              <Download className='h-4 w-4 shrink-0' />
              CSV
            </Button>

            <Button
              variant='outline'
              size='sm'
              onClick={() => onExport('json')}
            >
              <Download className='h-4 w-4 shrink-0' />
              JSON
            </Button>
          </div>
        </div>

        <div className='grid max-w-full min-w-0 gap-2 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]'>
          <div className='relative min-w-0'>
            <Search className='absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground' />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t('auditUi.searchPlaceholder')}
              className='min-w-0 pl-8'
            />
          </div>

          <Select
            value={aggregateFilter}
            onValueChange={onAggregateFilterChange}
          >
            <SelectTrigger
              aria-label={t('auditUi.aggregateFilter')}
              className='min-w-0'
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('auditUi.allRecords')}</SelectItem>
              {aggregates.map((aggregate) => (
                <SelectItem key={aggregate} value={aggregate}>
                  {aggregate}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={actorFilter} onValueChange={onActorFilterChange}>
            <SelectTrigger
              aria-label={t('auditUi.actorFilter')}
              className='min-w-0'
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('auditUi.allActors')}</SelectItem>
              {actors.map((actor) => (
                <SelectItem key={actor} value={actor}>
                  {actor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={classificationFilter}
            onValueChange={onClassificationFilterChange}
          >
            <SelectTrigger
              aria-label={t('auditUi.classificationFilter')}
              className='min-w-0'
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('auditUi.allSensitivity')}</SelectItem>
              <SelectItem value='operational'>
                {t('auditUi.operational')}
              </SelectItem>
              <SelectItem value='personal-data'>
                {t('auditUi.personalData')}
              </SelectItem>
              <SelectItem value='sensitive'>
                {t('auditUi.sensitive')}
              </SelectItem>
              <SelectItem value='system'>{t('auditUi.system')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className='max-w-full min-w-0 overflow-hidden p-0'>
        {/*
          The table is wider than the card at most widths, so the trailing columns sit past
          the edge. The fade marks that as scrollable rather than letting the record column
          look truncated.
        */}
        <div className='max-w-full overflow-x-auto faded-inline-end'>
          <Table containerClassName='max-h-[137svh] min-w-[900px] overflow-auto'>
            <TableHeader className='sticky top-0 z-10 bg-background'>
              <TableRow>
                <TableHead>{t('auditUi.when')}</TableHead>
                <TableHead>{t('auditUi.actor')}</TableHead>
                <TableHead>{t('auditUi.action')}</TableHead>
                <TableHead>{t('auditUi.record')}</TableHead>
                <TableHead>{t('auditUi.summary')}</TableHead>
                <TableHead>{t('auditUi.integrity')}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableBodySkeletonRows columns={6} rows={7} />
              ) : events.length === 0 ? (
                <AuditStateRow>
                  <EmptyState
                    className='min-h-56 border-0 bg-transparent'
                    icon={FileClock}
                    title={t('auditUi.noAuditEvents')}
                    description={t('auditUi.noAuditEventsDescription')}
                    action={{
                      label: t('auditUi.resetFilters'),
                      onClick: onResetFilters,
                    }}
                  />
                </AuditStateRow>
              ) : (
                pagination.pageRows.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className='font-mono text-xs text-muted-foreground'>
                      {formatLocaleDate(event.createdAt, locale, {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>{event.actorName}</TableCell>
                    <TableCell>
                      <Badge variant='outline'>{event.action}</Badge>
                    </TableCell>
                    <TableCell className='text-xs text-muted-foreground'>
                      <div>{event.aggregate}</div>
                      <div className='font-mono'>{event.aggregateId}</div>
                    </TableCell>
                    <TableCell className='max-w-[360px] whitespace-normal text-muted-foreground'>
                      {event.summary}
                    </TableCell>
                    <TableCell>
                      <Badge variant={event.hash ? 'secondary' : 'outline'}>
                        {event.hash ? t('auditUi.sealed') : t('auditUi.legacy')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!isLoading && <RowPagination pagination={pagination} />}
      </CardContent>
    </Card>
  )
}

export function AuditGovernancePanel({
  dataSubjectRequests,
  isLoading = false,
  privacyAccessEvents,
  retentionRules,
}: {
  dataSubjectRequests: DataSubjectRequest[]
  isLoading?: boolean
  privacyAccessEvents: AuditEvent[]
  retentionRules: {
    id: string
    dataset: string
    retentionYears: number
    legalBasis: string
  }[]
}) {
  if (isLoading) {
    return (
      <div className='max-w-full min-w-0 space-y-6 overflow-hidden'>
        <CardSectionSkeleton blocks={3} />
        <CardSectionSkeleton blocks={3} />
        <CardSectionSkeleton blocks={3} />
      </div>
    )
  }

  return (
    <div className='max-w-full min-w-0 space-y-6 overflow-hidden'>
      <PrivacyAccessCard events={privacyAccessEvents} />
      <RetentionCard retentionRules={retentionRules} />
      <DataSubjectRequestsCard requests={dataSubjectRequests} />
    </div>
  )
}

function AuditStateRow({ children }: { children: ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={6} className='p-4'>
        {children}
      </TableCell>
    </TableRow>
  )
}

function PrivacyAccessCard({ events }: { events: AuditEvent[] }) {
  const { locale, t } = useI18n()
  return (
    <Card className='max-w-full min-w-0 overflow-hidden'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex min-w-0 items-center gap-2 text-base'>
          <ShieldCheck className='h-4 w-4 shrink-0 text-muted-foreground' />
          <span className='min-w-0 [overflow-wrap:anywhere] break-words'>
            {t('auditUi.whoSawWhat')}
          </span>
        </CardTitle>

        <CardDescription>{t('auditUi.whoSawWhatDescription')}</CardDescription>
      </CardHeader>

      <CardContent className='space-y-2'>
        {events.slice(0, 6).map((event) => (
          <div key={event.id} className='min-w-0 rounded-md border p-3'>
            <div className='flex min-w-0 items-center justify-between gap-2'>
              <span className='min-w-0 text-sm font-medium [overflow-wrap:anywhere] break-words'>
                {event.actorName}
              </span>
              <Badge variant='secondary' className='shrink-0'>
                {formatLocaleDate(event.createdAt, locale, {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Badge>
            </div>

            <p className='mt-1 text-xs [overflow-wrap:anywhere] break-words text-muted-foreground'>
              {event.summary}
            </p>
          </div>
        ))}

        {events.length === 0 && (
          <div className='rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground'>
            {t('auditUi.noPrivacyAccessEvents')}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RetentionCard({
  retentionRules,
}: {
  retentionRules: {
    id: string
    dataset: string
    retentionYears: number
    legalBasis: string
  }[]
}) {
  const { t } = useI18n()
  return (
    <Card className='max-w-full min-w-0 overflow-hidden'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex min-w-0 items-center gap-2 text-base'>
          <FileClock className='h-4 w-4 shrink-0 text-muted-foreground' />
          <span>{t('auditUi.retentionModel')}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className='space-y-2'>
        {retentionRules.map((rule) => (
          <div key={rule.id} className='min-w-0 rounded-md border p-3'>
            <div className='flex min-w-0 items-center justify-between gap-2'>
              <span className='min-w-0 text-sm font-medium [overflow-wrap:anywhere] break-words'>
                {rule.dataset}
              </span>
              <Badge variant='secondary' className='shrink-0'>
                {t('auditUi.retentionYears', {
                  count: String(rule.retentionYears),
                })}
              </Badge>
            </div>

            <p className='mt-1 text-xs [overflow-wrap:anywhere] break-words text-muted-foreground'>
              {rule.legalBasis}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function DataSubjectRequestsCard({
  requests,
}: {
  requests: DataSubjectRequest[]
}) {
  const { locale, t } = useI18n()
  return (
    <Card className='max-w-full min-w-0 overflow-hidden'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex min-w-0 items-center gap-2 text-base'>
          <Download className='h-4 w-4 shrink-0 text-muted-foreground' />
          <span>{t('auditUi.dataSubjectRequests')}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className='space-y-2'>
        {requests.map((request) => (
          <div key={request.id} className='min-w-0 rounded-md border p-3'>
            <div className='flex min-w-0 items-center justify-between gap-2'>
              <span className='min-w-0 text-sm font-medium [overflow-wrap:anywhere] break-words'>
                {request.type}
              </span>
              <Badge variant='outline' className='shrink-0'>
                {request.status}
              </Badge>
            </div>

            <p className='mt-1 text-xs [overflow-wrap:anywhere] break-words text-muted-foreground'>
              {request.employeeId} ·{' '}
              {formatLocaleDate(request.requestedAt, locale, {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
        ))}

        <Alert>
          <Trash2 className='h-4 w-4' />
          <AlertTitle>{t('auditUi.deleteIsGated')}</AlertTitle>
          <AlertDescription>
            {t('auditUi.deleteIsGatedDescription')}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}

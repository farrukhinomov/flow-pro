import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  canViewFullAudit,
  getViewerManagedTeams,
} from '@/domain/access/access-control'
import type { EmployeeRequest } from '@/domain/requests/types'
import { useI18n } from '@/i18n'
import { FileClock, FileText, ListChecks, UserCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CardSectionSkeleton } from '@/components/flowpro/loading-skeletons'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { useCurrentViewer } from '@/features/access/use-current-viewer'
import { RouteError } from '@/features/errors/route-error'
import { ApprovalQueueCard } from '@/features/requests/components/approval-queue-card'
import { RequestDraftPanel } from '@/features/requests/components/request-draft-panel'
import { RequestHistoryCard } from '@/features/requests/components/request-history-card'
import { RequestReviewDrawer } from '@/features/requests/components/request-review-drawer'
import { RequestTable } from '@/features/requests/components/request-table'
import { useEmployeeRequests } from '@/features/requests/hooks/use-employee-requests'
import {
  buildRequestRows,
  filterApprovalRows,
  filterHistoryRows,
  getApprovalEmployees,
  getApprovalRows,
  getHistoryRows,
  getTodayString,
  type RequestKind,
} from '@/features/requests/request-view-model'

export const Route = createFileRoute('/_authenticated/requests/')({
  validateSearch: (search: Record<string, unknown>) => ({
    kind:
      search.kind === 'booking' ||
      search.kind === 'official' ||
      search.kind === 'absence'
        ? (search.kind as RequestKind)
        : undefined,
  }),
  component: RequestsPage,
  errorComponent: RouteError,
})

const today = getTodayString()
const ALL = 'all'
// Only the request type is remembered between visits. Which employee a manager filtered by is
// personal data, so it is not written to the browser's storage.
const APPROVAL_KIND_FILTER_KEY = 'flowpro.requests.approval-kind-filter'
// Earlier builds stored the employee filter here too. It is removed on first use.
const LEGACY_APPROVAL_FILTERS_KEY = 'flowpro.requests.approval-filters'

function readApprovalKindFilter() {
  if (typeof window === 'undefined') return ALL

  try {
    window.localStorage.removeItem(LEGACY_APPROVAL_FILTERS_KEY)
    return window.localStorage.getItem(APPROVAL_KIND_FILTER_KEY) ?? ALL
  } catch {
    return ALL
  }
}

function persistApprovalKindFilter(kindFilter: string) {
  try {
    window.localStorage.setItem(APPROVAL_KIND_FILTER_KEY, kindFilter)
  } catch {
    // Storage can be unavailable, for example in a private window; the filter still applies.
  }
}

function RequestsPage() {
  const { t } = useI18n()
  const { kind } = Route.useSearch()
  const viewer = useCurrentViewer()
  const initialApprovalKindFilter = useMemo(() => readApprovalKindFilter(), [])
  const {
    attendanceTypes,
    approveAdjustedRequest,
    cancelRequest,
    decideRequest,
    decideRequests,
    isLoading,
    loadAuditTrail,
    requests,
    submitRequest,
    syncMeta,
    users,
  } = useEmployeeRequests()
  const [search, setSearch] = useState('')
  const [approvalEmployeeFilter, setApprovalEmployeeFilter] = useState(ALL)
  const [approvalKindFilter, setApprovalKindFilter] = useState(
    initialApprovalKindFilter
  )
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<string[]>([])
  const [reviewRequest, setReviewRequest] = useState<EmployeeRequest | null>(
    null
  )

  const employeeById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users]
  )
  const rows = useMemo(
    () => buildRequestRows({ attendanceTypes, requests, users, viewer }),
    [attendanceTypes, requests, users, viewer]
  )
  const myRows = useMemo(
    () => rows.filter((row) => row.request.employeeId === viewer.employeeId),
    [rows, viewer.employeeId]
  )
  const approvalRows = useMemo(
    () => getApprovalRows({ employeeById, rows, viewer }),
    [employeeById, rows, viewer]
  )
  const approvalEmployees = useMemo(
    () => getApprovalEmployees(approvalRows),
    [approvalRows]
  )
  const filteredApprovalRows = useMemo(
    () =>
      filterApprovalRows({
        employeeFilter: approvalEmployeeFilter,
        kindFilter: approvalKindFilter,
        rows: approvalRows,
      }),
    [approvalEmployeeFilter, approvalKindFilter, approvalRows]
  )
  const historyRows = useMemo(
    () => getHistoryRows({ employeeById, rows, viewer }),
    [employeeById, rows, viewer]
  )
  const filteredHistoryRows = useMemo(
    () => filterHistoryRows({ rows: historyRows, search, t }),
    [historyRows, search, t]
  )

  const clearApprovalSelection = () => setSelectedApprovalIds([])
  const managedTeamsLabel = getViewerManagedTeams(viewer).join(', ')
  const canReviewApprovals =
    viewer.role === 'manager' || canViewFullAudit(viewer)

  return (
    <>
      <Header>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='max-w-full min-w-0 overflow-x-hidden'>
        <div className='mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>
              {t('requestsPage.title')}
            </h1>
            <p className='mt-1 text-sm text-muted-foreground'>
              {t('requestsPage.subtitle')}
            </p>
          </div>
          {!!syncMeta?.pendingCount && (
            <Badge variant='outline' className='w-fit'>
              {t('requestsPage.syncing', { count: syncMeta.pendingCount })}
            </Badge>
          )}
        </div>

        <Tabs defaultValue='new' className='gap-4'>
          <div className='overflow-x-auto faded-inline-end'>
            <TabsList className='w-max min-w-max'>
              <TabsTrigger value='new'>
                <FileText className='h-4 w-4' />
                {t('requestsPage.tabCreate')}
              </TabsTrigger>
              <TabsTrigger value='my'>
                <FileClock className='h-4 w-4' />
                {t('requestsPage.tabMine')}
              </TabsTrigger>
              <TabsTrigger value='approvals'>
                <UserCheck className='h-4 w-4' />
                {t('requestsPage.tabApprovals')}
              </TabsTrigger>
              <TabsTrigger value='history'>
                <ListChecks className='h-4 w-4' />
                {t('requestsPage.tabHistory')}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value='new'>
            {isLoading ? (
              <div className='grid min-w-0 gap-6 xl:grid-cols-[220px_minmax(0,1fr)_320px]'>
                <CardSectionSkeleton blocks={4} />
                <CardSectionSkeleton blocks={6} />
                <CardSectionSkeleton blocks={5} />
              </div>
            ) : (
              <RequestDraftPanel
                attendanceTypes={attendanceTypes}
                initialKind={kind}
                requests={requests}
                today={today}
                viewer={viewer}
                onSubmit={submitRequest}
              />
            )}
          </TabsContent>

          <TabsContent value='my'>
            <RequestTable
              rows={myRows}
              isLoading={isLoading}
              actions='mine'
              onCancel={(request) => void cancelRequest(request.id)}
            />
          </TabsContent>

          <TabsContent value='approvals'>
            {!canReviewApprovals && (
              <p className='mb-3 text-xs text-muted-foreground'>
                {t('requestsPage.restricted')}
              </p>
            )}
            {viewer.role === 'manager' && managedTeamsLabel ? (
              <p className='mb-3 text-xs text-muted-foreground'>
                {t('requestsPage.approvingFor', { teams: managedTeamsLabel })}
              </p>
            ) : null}
            <ApprovalQueueCard
              employeeFilter={approvalEmployeeFilter}
              employees={approvalEmployees}
              isLoading={isLoading}
              kindFilter={approvalKindFilter}
              rows={filteredApprovalRows}
              selectedIds={selectedApprovalIds}
              onBatchDecision={async (ids, decision, comment) => {
                await decideRequests(ids, decision, comment)
                const remaining = new Set(
                  filteredApprovalRows
                    .map((row) => row.id)
                    .filter((id) => !ids.includes(id))
                )
                setSelectedApprovalIds((current) =>
                  current.filter((id) => remaining.has(id))
                )
              }}
              onEmployeeFilterChange={(value) => {
                setApprovalEmployeeFilter(value)
                clearApprovalSelection()
              }}
              onKindFilterChange={(value) => {
                setApprovalKindFilter(value)
                persistApprovalKindFilter(value)
                clearApprovalSelection()
              }}
              allRequests={requests}
              onReview={setReviewRequest}
              onSelectAll={(checked) =>
                setSelectedApprovalIds(
                  checked ? filteredApprovalRows.map((row) => row.id) : []
                )
              }
              onSelectRow={(id, checked) =>
                setSelectedApprovalIds((current) =>
                  checked
                    ? Array.from(new Set([...current, id]))
                    : current.filter((item) => item !== id)
                )
              }
            />
          </TabsContent>

          <TabsContent value='history'>
            <RequestHistoryCard
              rows={filteredHistoryRows}
              isLoading={isLoading}
              search={search}
              onSearchChange={setSearch}
            />
          </TabsContent>
        </Tabs>

        <RequestReviewDrawer
          allRequests={requests}
          attendanceTypes={attendanceTypes}
          request={reviewRequest}
          loadAuditTrail={loadAuditTrail}
          users={users}
          viewer={viewer}
          onOpenChange={(open) => {
            if (!open) setReviewRequest(null)
          }}
          onDecision={async (request, decision, comment) => {
            await decideRequest(request.id, decision, comment)
            setReviewRequest(null)
          }}
          onApproveAdjusted={async (request, draft, comment) => {
            await approveAdjustedRequest(request.id, draft, comment)
            setReviewRequest(null)
          }}
        />
      </Main>
    </>
  )
}

import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  canViewTeamPlanning,
  type AppViewer,
} from '@/domain/access/access-control'
import { calculateTeamCapacity } from '@/domain/planning/capacity'
import { useI18n } from '@/i18n'
import { formatLocaleDate } from '@/i18n/format'
import {
  CalendarDays,
  FileSpreadsheet,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { downloadCsvFile } from '@/lib/download'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CardSectionSkeleton,
  FilterBarSkeleton,
  MetricCardsSkeleton,
  TabsListSkeleton,
} from '@/components/flowpro/loading-skeletons'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { useCurrentViewer } from '@/features/access/use-current-viewer'
import { RouteError } from '@/features/errors/route-error'
import { usePlanningAvailability } from '@/features/planning/hooks/use-planning-availability'
import {
  AvailabilityMetric,
  CapacityHeatmap,
  CapacityTable,
  ConflictPanel,
  RosterGrid,
} from '@/features/team-availability/components'
import {
  buildTeamCapacityCsv,
  filterTeamAvailabilityMembers,
  getCapacityDaysForDate,
  getRemoteMembers,
  getReturningSoonMembers,
  getTeamCapacityExportName,
  getUnavailableMembers,
} from '@/features/team-availability/team-availability-view-model'

export const Route = createFileRoute('/_authenticated/team-availability/')({
  component: TeamAvailabilityPage,
  errorComponent: RouteError,
})

function TeamAvailabilityPage() {
  const { t } = useI18n()
  const viewer = useCurrentViewer()

  if (!canViewTeamPlanning(viewer)) {
    return (
      <TeamAvailabilityAccessRestricted
        title={t('teamAvailabilityUi.accessRestricted')}
        description={t('teamAvailabilityUi.accessRestrictedDescription')}
      />
    )
  }

  return <TeamAvailabilityWorkspace viewer={viewer} />
}

function TeamAvailabilityWorkspace({ viewer }: { viewer: AppViewer }) {
  const { locale, t } = useI18n()
  const [search, setSearch] = useState('')
  const today = useMemo(() => new Date(), [])
  const { isLoading, members, people, syncMeta } = usePlanningAvailability(
    today,
    viewer
  )

  const filteredMembers = useMemo(
    () => filterTeamAvailabilityMembers(members, search),
    [members, search]
  )

  const unavailableToday = getUnavailableMembers(filteredMembers)
  const remoteToday = getRemoteMembers(filteredMembers)
  const returningSoon = getReturningSoonMembers({
    members: filteredMembers,
    today,
  })
  const capacityDays = useMemo(
    () => calculateTeamCapacity({ days: 14, people, startDate: today }),
    [people, today]
  )
  const todayCapacity = getCapacityDaysForDate(capacityDays, today)
  const filteredCapacityDays = capacityDays.filter(
    (day) =>
      filteredMembers.some((member) => member.team === day.team) ||
      day.team.toLowerCase().includes(search.toLowerCase())
  )
  const conflictDays = filteredCapacityDays.filter(
    (day) => day.status === 'conflict'
  )
  const tightDays = filteredCapacityDays.filter((day) => day.status === 'tight')
  const capacityTotal = todayCapacity.reduce(
    (sum, day) => sum + day.capacity,
    0
  )

  const exportCapacity = () => {
    downloadCsvFile(
      getTeamCapacityExportName(today),
      buildTeamCapacityCsv(filteredCapacityDays)
    )
  }

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
              {t('nav.teamAvailability')}
            </h1>
            <p className='mt-1 text-sm text-muted-foreground'>
              {t('teamAvailabilityUi.availabilityForDate', {
                date: formatLocaleDate(today, locale, {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                }),
              })}
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size='sm' className='gap-2' asChild>
              <Link to='/planning'>
                <CalendarDays className='h-4 w-4' />
                {t('teamAvailabilityUi.openPlanning')}
              </Link>
            </Button>
            <Button
              variant='outline'
              size='sm'
              className='gap-2'
              onClick={exportCapacity}
            >
              <FileSpreadsheet className='h-4 w-4' />
              {t('teamAvailabilityUi.export')}
            </Button>
          </div>
        </div>

        <div className='mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          <AvailabilityMetric
            label={t('teamAvailabilityUi.capacity')}
            value={Number(capacityTotal.toFixed(1))}
            helper={t('teamAvailabilityUi.fteAvailableToday')}
            tone='success'
          />
          <AvailabilityMetric
            label={t('teamAvailabilityUi.remote')}
            value={remoteToday.length}
            helper={t('teamAvailabilityUi.workingOutsideOffice')}
            tone='remote'
          />
          <AvailabilityMetric
            label={t('teamAvailabilityUi.conflicts')}
            value={conflictDays.length}
            helper={t('teamAvailabilityUi.belowStaffingRule')}
            tone='danger'
          />
          <AvailabilityMetric
            label={t('teamAvailabilityUi.returningSoon')}
            value={returningSoon.length}
            helper={t('teamAvailabilityUi.withinNext7Days')}
            tone='default'
          />
        </div>

        <Card className='mb-6'>
          <CardContent className='flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between'>
            <div className='flex items-start gap-3'>
              <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground'>
                <ShieldCheck className='h-4 w-4' />
              </div>
              <div>
                <div className='text-sm font-medium'>
                  {t('teamAvailabilityUi.privacyByDefault')}
                </div>
                <p className='mt-1 max-w-3xl text-sm text-muted-foreground'>
                  {t('teamAvailabilityUi.privacyByDefaultDescription')}
                </p>
              </div>
            </div>
            <Button variant='outline' size='sm' asChild>
              <Link to='/settings/attendance'>
                {t('teamAvailabilityUi.managePolicy')}
              </Link>
            </Button>
          </CardContent>
        </Card>

        {!!syncMeta?.pendingCount && (
          <div className='mb-4'>
            <Badge variant='outline'>
              {t('requestsPage.syncing', {
                count: String(syncMeta.pendingCount),
              })}
            </Badge>
          </div>
        )}

        {isLoading ? (
          <TeamAvailabilitySkeleton />
        ) : (
          <Tabs defaultValue='overview' className='min-w-0 gap-4'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <TabsList className='w-full sm:w-fit'>
                <TabsTrigger value='overview'>
                  {t('teamAvailabilityUi.overview')}
                </TabsTrigger>
                <TabsTrigger value='capacity'>
                  {t('teamAvailabilityUi.capacity')}
                  <Badge
                    variant='secondary'
                    className='ms-1 h-5 px-1.5 text-[10px]'
                  >
                    {conflictDays.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value='heatmap'>
                  {t('teamAvailabilityUi.heatmap')}
                </TabsTrigger>
                <TabsTrigger value='unavailable'>
                  {t('teamAvailabilityUi.unavailable')}
                  <Badge
                    variant='secondary'
                    className='ms-1 h-5 px-1.5 text-[10px]'
                  >
                    {unavailableToday.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value='returning'>
                  {t('teamAvailabilityUi.returningSoon')}
                </TabsTrigger>
              </TabsList>
              <div className='relative w-full sm:w-72'>
                <Search className='absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground' />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('teamAvailabilityUi.searchPlaceholder')}
                  className='pl-8'
                />
              </div>
            </div>

            <TabsContent value='overview'>
              <div className='grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]'>
                <RosterGrid members={filteredMembers} />
                <ConflictPanel
                  conflictDays={conflictDays}
                  tightDays={tightDays}
                />
              </div>
            </TabsContent>

            <TabsContent value='capacity'>
              <CapacityTable days={filteredCapacityDays} />
            </TabsContent>

            <TabsContent value='heatmap'>
              <CapacityHeatmap days={filteredCapacityDays} />
            </TabsContent>

            <TabsContent value='unavailable'>
              <RosterGrid
                emptyLabel={t('teamAvailabilityUi.everyoneAvailable')}
                members={unavailableToday}
              />
            </TabsContent>

            <TabsContent value='returning'>
              <RosterGrid
                emptyLabel={t('teamAvailabilityUi.noReturns')}
                members={returningSoon}
              />
            </TabsContent>
          </Tabs>
        )}
      </Main>
    </>
  )
}

function TeamAvailabilitySkeleton() {
  return (
    <div className='space-y-4'>
      <MetricCardsSkeleton />
      <TabsListSkeleton
        widths={['w-28', 'w-32', 'w-28', 'w-32', 'w-32']}
        items={5}
      />
      <FilterBarSkeleton filters={0} />
      <div className='grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]'>
        <CardSectionSkeleton blocks={6} />
        <CardSectionSkeleton blocks={4} />
      </div>
    </div>
  )
}

function TeamAvailabilityAccessRestricted({
  description,
  title,
}: {
  description: string
  title: string
}) {
  return (
    <>
      <Header>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>
      <Main className='max-w-full min-w-0 overflow-x-hidden'>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
        </Card>
      </Main>
    </>
  )
}

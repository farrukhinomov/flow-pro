import { useEffect, useMemo, useState } from 'react'
import { format, startOfMonth } from 'date-fns'
import { createFileRoute, Link } from '@tanstack/react-router'
import { getAttendancePolicyConfigBackendFirst } from '@/data/attendance-policy.gateway'
import {
  canViewTeamPlanning,
  type AppViewer,
} from '@/domain/access/access-control'
import { getDefaultAttendancePolicyConfig } from '@/domain/attendance/policies'
import type { AttendancePolicyConfig } from '@/domain/attendance/types'
import {
  calculateTeamCapacity,
  findCoverageCandidates,
  simulateApprovalImpact,
  type ApprovalImpactSimulation,
} from '@/domain/planning/capacity'
import { useI18n } from '@/i18n'
import { formatLocaleDate } from '@/i18n/format'
import {
  AlertTriangle,
  CalendarDays,
  FileSpreadsheet,
  Home,
  Search,
  ShieldCheck,
  Umbrella,
  Users,
} from 'lucide-react'
import { downloadCsvFile } from '@/lib/download'
import { resolvePeriodWindowBounds } from '@/lib/period-window'
import { getCurrentMonthDate, getCurrentYearDate } from '@/lib/periods'
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
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CardSectionSkeleton,
  FilterBarSkeleton,
  MetricCardsSkeleton,
  TabsListSkeleton,
} from '@/components/flowpro/loading-skeletons'
import { MonthYearPicker } from '@/components/flowpro/month-year-picker'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { useCurrentViewer } from '@/features/access/use-current-viewer'
import { RouteError } from '@/features/errors/route-error'
import {
  ApprovalImpactPanel,
  BalanceSummary,
  CapacityForecast,
  CoveragePlanner,
  Legend,
  PersonalYearCalendar,
  PlanningInsight,
  TeamMonthCalendar,
} from '@/features/planning/components'
import { usePlanningAvailability } from '@/features/planning/hooks/use-planning-availability'
import {
  buildPlanningCsv,
  getPlanningStats,
} from '@/features/planning/planning-view-model'

export const Route = createFileRoute('/_authenticated/planning/')({
  component: PlanningPage,
  errorComponent: RouteError,
})

function PlanningPage() {
  const { t } = useI18n()
  const viewer = useCurrentViewer()

  if (!canViewTeamPlanning(viewer)) {
    return (
      <PlanningAccessRestricted
        title={t('planningUi.accessRestricted')}
        description={t('planningUi.accessRestrictedDescription')}
      />
    )
  }

  return <PlanningWorkspace viewer={viewer} />
}

function PlanningWorkspace({ viewer }: { viewer: AppViewer }) {
  const { locale, t } = useI18n()
  const [month, setMonth] = useState(() => getCurrentMonthDate())
  const { isLoading, people, requests, syncMeta } = usePlanningAvailability(
    month,
    viewer
  )
  const yearStart = getCurrentYearDate()
  const [policyConfig, setPolicyConfig] =
    useState<AttendancePolicyConfig | null>(null)
  const planningWindow = useMemo(
    () =>
      resolvePeriodWindowBounds(
        getCurrentMonthDate(),
        policyConfig?.periodWindows.planning ??
          getDefaultAttendancePolicyConfig().periodWindows.planning
      ),
    [policyConfig]
  )
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let isMounted = true

    void getAttendancePolicyConfigBackendFirst().then((nextPolicy) => {
      if (!isMounted) return
      setPolicyConfig(nextPolicy)
    })

    return () => {
      isMounted = false
    }
  }, [])

  const selectedPerson =
    people.find((person) => person.id === selectedPersonId) ?? people[0]

  const filteredPeople = people.filter((person) =>
    `${person.name} ${person.role} ${person.team}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )
  const capacityForecast = useMemo(
    () =>
      calculateTeamCapacity({
        days: 31,
        people: filteredPeople.length ? filteredPeople : people,
        startDate: startOfMonth(month),
      }),
    [filteredPeople, month, people]
  )
  const conflictForecast = capacityForecast.filter(
    (day) => day.status === 'conflict'
  )
  const selectedDate = format(month, 'yyyy-MM-dd')
  const selectedTeam = selectedPerson?.team ?? filteredPeople[0]?.team ?? ''
  const coverageCandidates = useMemo(
    () =>
      selectedTeam
        ? findCoverageCandidates({
            date: selectedDate,
            people,
            team: selectedTeam,
          })
        : [],
    [people, selectedDate, selectedTeam]
  )
  const pendingImpacts = useMemo(
    () =>
      requests
        .filter((request) => request.status === 'submitted')
        .map((request) => simulateApprovalImpact({ people, request }))
        .filter((impact): impact is ApprovalImpactSimulation => !!impact),
    [people, requests]
  )
  const planningStats = useMemo(
    () =>
      getPlanningStats({
        conflictCount: conflictForecast.length,
        month,
        people,
      }),
    [conflictForecast.length, month, people]
  )

  const exportPlanning = () => {
    const csv = buildPlanningCsv({
      month,
      people: filteredPeople.length ? filteredPeople : people,
    })
    downloadCsvFile(`flowpro-planning-${format(month, 'yyyy-MM')}.csv`, csv)
  }

  return (
    <>
      <Header>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main fluid className='flex h-full flex-col gap-4 overflow-hidden'>
        <div className='flex flex-col gap-3 px-2 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>
              {t('nav.planning')}
            </h1>
            <p className='mt-1 text-sm text-muted-foreground'>
              {t('planningUi.subtitle')}
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='gap-2'
              onClick={exportPlanning}
            >
              <FileSpreadsheet className='h-4 w-4' />
              {t('teamAvailabilityUi.export')}
            </Button>
          </div>
        </div>

        <div className='grid gap-3 px-2 sm:grid-cols-2 xl:grid-cols-4'>
          <PlanningInsight
            icon={Home}
            label={t('planningUi.remoteDays')}
            value={planningStats.remoteDays}
            helper={formatLocaleDate(month, locale, {
              month: 'long',
              year: 'numeric',
            })}
            tone='remote'
          />
          <PlanningInsight
            icon={Umbrella}
            label={t('planningUi.leaveDays')}
            value={planningStats.leaveDays}
            helper={t('planningUi.approvedOrPlanned')}
            tone='success'
          />
          <PlanningInsight
            icon={AlertTriangle}
            label={t('teamAvailabilityUi.conflicts')}
            value={planningStats.conflicts}
            helper={t('planningUi.capacityForecast')}
            tone={planningStats.conflicts ? 'warning' : 'muted'}
          />
          <PlanningInsight
            icon={ShieldCheck}
            label={t('planningUi.confidential')}
            value={planningStats.confidential}
            helper={t('planningUi.detailsHiddenByPolicy')}
            tone='muted'
          />
        </div>

        {!!syncMeta?.pendingCount && (
          <div className='px-2'>
            <Badge variant='outline'>
              {t('requestsPage.syncing', {
                count: String(syncMeta.pendingCount),
              })}
            </Badge>
          </div>
        )}

        {isLoading || !selectedPerson ? (
          <PlanningSkeleton />
        ) : (
          <Tabs defaultValue='mine' className='min-h-0 min-w-0 flex-1 gap-4'>
            <div className='flex flex-col gap-3 px-2 lg:flex-row lg:items-center lg:justify-between'>
              {/*
                The legend beside these tabs is wide enough to squeeze them on a
                single row, which truncated the last tab label. The tabs keep
                their intrinsic width and the legend wraps instead.
              */}
              <TabsList className='w-full shrink-0 sm:w-fit'>
                <TabsTrigger value='mine'>
                  <CalendarDays className='h-4 w-4' />
                  {t('planningUi.myCalendar')}
                </TabsTrigger>
                <TabsTrigger value='team'>
                  <Users className='h-4 w-4' />
                  {t('planningUi.teamCalendar')}
                </TabsTrigger>
                <TabsTrigger value='forecast'>
                  <AlertTriangle className='h-4 w-4' />
                  {t('planningUi.forecast')}
                </TabsTrigger>
                <TabsTrigger value='cover'>{t('planningUi.cover')}</TabsTrigger>
                <TabsTrigger value='impact'>
                  {t('planningUi.impact')}
                </TabsTrigger>
              </TabsList>

              <Legend />
            </div>

            <TabsContent value='mine' className='min-h-0'>
              <div className='grid min-h-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]'>
                <Card className='h-fit'>
                  <CardHeader className='pb-3'>
                    <CardTitle className='text-sm font-medium'>
                      {t('planningUi.calendarOwner')}
                    </CardTitle>
                    <CardDescription>
                      {t('planningUi.switchBetweenPeople')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <Select
                      value={selectedPersonId || selectedPerson.id}
                      onValueChange={setSelectedPersonId}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {people.map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Separator />

                    <BalanceSummary person={selectedPerson} />

                    <Separator />

                    <div className='space-y-2'>
                      <Button className='w-full' asChild>
                        <Link to='/requests' search={{ kind: 'absence' }}>
                          {t('today.newRequest')}
                        </Link>
                      </Button>
                      <Button variant='outline' className='w-full' asChild>
                        <Link to='/requests' search={{ kind: undefined }}>
                          {t('planningUi.reviewRequests')}
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className='min-h-0 overflow-hidden'>
                  <CardHeader className='flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between'>
                    <div>
                      <CardTitle className='text-base'>
                        {selectedPerson.name}
                      </CardTitle>
                      <CardDescription>
                        {t('planningUi.personalPlanningYearStarting')}{' '}
                        {format(yearStart, 'yyyy')}
                      </CardDescription>
                    </div>
                    <div className='rounded-md border px-3 py-2 text-sm font-medium'>
                      {format(yearStart, 'yyyy')}
                    </div>
                  </CardHeader>
                  <CardContent className='p-0'>
                    <PersonalYearCalendar
                      person={selectedPerson}
                      yearStart={yearStart}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value='team' className='min-h-0'>
              <Card className='flex min-h-0 flex-col overflow-hidden'>
                <CardHeader className='flex flex-col gap-3 pb-3 lg:flex-row lg:items-center lg:justify-between'>
                  <div>
                    <CardTitle className='text-base'>
                      {t('nav.teamAvailability')}
                    </CardTitle>
                    <CardDescription>
                      {t('planningUi.teamAvailabilityDescription')}
                    </CardDescription>
                  </div>
                  <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                    <div className='relative w-full sm:w-56'>
                      <Search className='absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground' />
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('planningUi.searchTeam')}
                        className='pl-8'
                      />
                    </div>
                    <MonthYearPicker
                      max={planningWindow.max}
                      min={planningWindow.min}
                      value={month}
                      onChange={setMonth}
                      className='w-full sm:w-auto'
                    />
                  </div>
                </CardHeader>
                <CardContent className='min-h-0 p-0'>
                  <TeamMonthCalendar month={month} people={filteredPeople} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value='forecast' className='min-h-0'>
              <CapacityForecast
                days={capacityForecast}
                month={month}
                people={filteredPeople}
              />
            </TabsContent>

            <TabsContent value='cover' className='min-h-0'>
              <CoveragePlanner
                candidates={coverageCandidates}
                date={selectedDate}
                team={selectedTeam}
              />
            </TabsContent>

            <TabsContent value='impact' className='min-h-0'>
              <ApprovalImpactPanel impacts={pendingImpacts} />
            </TabsContent>
          </Tabs>
        )}
      </Main>
    </>
  )
}

function PlanningSkeleton() {
  return (
    <div className='space-y-4 px-2'>
      <TabsListSkeleton
        widths={['w-28', 'w-32', 'w-32', 'w-24', 'w-24']}
        items={5}
      />
      <MetricCardsSkeleton />
      <FilterBarSkeleton filters={1} />
      <div className='grid min-h-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]'>
        <CardSectionSkeleton blocks={4} />
        <CardSectionSkeleton blocks={6} />
      </div>
    </div>
  )
}

function PlanningAccessRestricted({
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

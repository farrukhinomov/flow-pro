import { useMemo, useState } from 'react'
import type {
  DepartmentCatalog,
  LocationCatalog,
  OrganizationCatalogRecord,
  RoleProfile,
  TeamCatalog,
  WorkPatternCatalog,
} from '@/domain/organization/types'
import type { EmployeeUser, UserRole } from '@/domain/users/types'
import { useI18n } from '@/i18n'
import {
  BriefcaseBusiness,
  HeartHandshake,
  Shield,
  UserCheck,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/flowpro/empty-state'
import {
  CardSectionSkeleton,
  TabsListSkeleton,
} from '@/components/flowpro/loading-skeletons'
import { MultiSelectChips } from '@/components/flowpro/multi-select-chips'
import { SearchableSelect } from '@/components/flowpro/searchable-select'
import { CatalogDrawer } from './organization-catalog-drawer'
import { CatalogTableCard, StatusBadge } from './organization-catalog-table'
import type { OrganizationDrawerState } from './organization-catalog-types'
import { useUsers } from './users-provider'

type OrganizationAdminProps = {
  canManage: boolean
  delegationsByManager: Record<string, string[]>
  departments: DepartmentCatalog[]
  isLoading: boolean
  locations: LocationCatalog[]
  managers: EmployeeUser[]
  onSaveRecord: (record: OrganizationCatalogRecord) => Promise<void>
  onSaveManagerTeams: (managerId: string, teams: string[]) => Promise<void>
  roleProfiles: RoleProfile[]
  teams: TeamCatalog[]
  workPatterns: WorkPatternCatalog[]
}

const ROLE_ICONS: Record<UserRole, typeof Shield> = {
  superadmin: Shield,
  admin: UserCheck,
  hr: HeartHandshake,
  manager: Users,
  employee: BriefcaseBusiness,
}

export function OrganizationAdmin({
  canManage,
  delegationsByManager,
  departments,
  isLoading,
  locations,
  managers,
  onSaveManagerTeams,
  onSaveRecord,
  roleProfiles,
  teams,
  workPatterns,
}: OrganizationAdminProps) {
  const { t } = useI18n()
  const { setOpen } = useUsers()
  const [drawerState, setDrawerState] = useState<OrganizationDrawerState>(null)
  const [selectedManagerId, setSelectedManagerId] = useState('')
  const [delegatedTeamsDraft, setDelegatedTeamsDraft] = useState<string[]>([])

  const effectiveSelectedManagerId = selectedManagerId || managers[0]?.id || ''
  const selectedManager = managers.find(
    (manager) => manager.id === effectiveSelectedManagerId
  )
  const delegatedTeamsValue =
    selectedManagerId === ''
      ? (delegationsByManager[effectiveSelectedManagerId] ?? [])
      : delegatedTeamsDraft
  const teamOptions = useMemo(
    () =>
      teams.filter((team) => team.status === 'active').map((team) => team.name),
    [teams]
  )
  const currentDelegatedTeams = delegatedTeamsValue
  const availableTeamsToAdd = teamOptions.filter(
    (team) =>
      !currentDelegatedTeams.includes(team) && team !== selectedManager?.team
  )

  if (isLoading) {
    return (
      <div className='space-y-4'>
        <TabsListSkeleton items={4} widths={['w-32', 'w-28', 'w-40', 'w-28']} />
        <CardSectionSkeleton blocks={5} className='min-h-72' />
      </div>
    )
  }

  return (
    <>
      <Tabs defaultValue='roles' className='space-y-4'>
        <div className='overflow-x-auto'>
          <TabsList className='w-max min-w-max'>
            <TabsTrigger value='departments'>
              {t('usersUi.departments')}
            </TabsTrigger>
            <TabsTrigger value='locations'>
              {t('usersUi.locations')}
            </TabsTrigger>
            <TabsTrigger value='roles'>{t('usersUi.roleProfiles')}</TabsTrigger>
            <TabsTrigger value='teams'>{t('usersUi.teams')}</TabsTrigger>
            <TabsTrigger value='work-patterns'>
              {t('usersUi.workPatterns')}
            </TabsTrigger>
            <TabsTrigger value='managers'>{t('usersUi.managers')}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value='departments'>
          <CatalogTableCard
            actionLabel={t('usersUi.newDepartment')}
            canManage={canManage}
            description={t('usersUi.departmentsDescription')}
            onCreate={() => setDrawerState({ kind: 'department' })}
            title={t('usersUi.departments')}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('usersUi.code')}</TableHead>
                  <TableHead>{t('usersUi.name')}</TableHead>
                  <TableHead>{t('usersUi.status')}</TableHead>
                  <TableHead className='w-[120px]' />
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((department) => (
                  <TableRow key={department.id}>
                    <TableCell>{department.code}</TableCell>
                    <TableCell>
                      <div className='font-medium'>{department.name}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={department.status} />
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        variant='ghost'
                        size='sm'
                        disabled={!canManage}
                        onClick={() =>
                          setDrawerState({
                            kind: 'department',
                            record: department,
                          })
                        }
                      >
                        {t('common.update')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CatalogTableCard>
        </TabsContent>

        <TabsContent value='locations'>
          <CatalogTableCard
            actionLabel={t('usersUi.newLocation')}
            canManage={canManage}
            description={t('usersUi.locationsDescription')}
            onCreate={() => setDrawerState({ kind: 'location' })}
            title={t('usersUi.locations')}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('usersUi.code')}</TableHead>
                  <TableHead>{t('usersUi.name')}</TableHead>
                  <TableHead>{t('usersUi.timeZone')}</TableHead>
                  <TableHead>{t('usersUi.status')}</TableHead>
                  <TableHead className='w-[120px]' />
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell>{location.code}</TableCell>
                    <TableCell>
                      <div className='font-medium'>{location.name}</div>
                    </TableCell>
                    <TableCell>{location.timeZoneId}</TableCell>
                    <TableCell>
                      <StatusBadge status={location.status} />
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        variant='ghost'
                        size='sm'
                        disabled={!canManage}
                        onClick={() =>
                          setDrawerState({
                            kind: 'location',
                            record: location,
                          })
                        }
                      >
                        {t('common.update')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CatalogTableCard>
        </TabsContent>

        <TabsContent value='roles'>
          <CatalogTableCard
            actionLabel={t('usersUi.newRoleProfile')}
            canManage={canManage}
            description={t('usersUi.roleProfilesDescription')}
            onCreate={() => setDrawerState({ kind: 'role' })}
            title={t('usersUi.roleProfiles')}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('usersUi.role')}</TableHead>
                  <TableHead>{t('usersUi.baseRole')}</TableHead>
                  <TableHead>{t('usersUi.status')}</TableHead>
                  <TableHead className='w-[120px]' />
                </TableRow>
              </TableHeader>
              <TableBody>
                {roleProfiles.map((profile) => {
                  const Icon = ROLE_ICONS[profile.baseRole]
                  return (
                    <TableRow key={profile.id}>
                      <TableCell>
                        <div className='flex items-center gap-2'>
                          <Icon className='h-4 w-4 text-muted-foreground' />
                          <div>
                            <div className='font-medium'>{profile.label}</div>
                            {profile.description ? (
                              <div className='text-xs text-muted-foreground'>
                                {profile.description}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{profile.baseRole}</TableCell>
                      <TableCell>
                        <StatusBadge status={profile.status} />
                      </TableCell>
                      <TableCell className='text-right'>
                        <Button
                          variant='ghost'
                          size='sm'
                          disabled={!canManage}
                          onClick={() =>
                            setDrawerState({ kind: 'role', record: profile })
                          }
                        >
                          {t('common.update')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CatalogTableCard>
        </TabsContent>

        <TabsContent value='teams'>
          <CatalogTableCard
            actionLabel={t('usersUi.newTeam')}
            canManage={canManage}
            description={t('usersUi.teamsDescription')}
            onCreate={() => setDrawerState({ kind: 'team' })}
            title={t('usersUi.teams')}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('usersUi.team')}</TableHead>
                  <TableHead>{t('usersUi.manager')}</TableHead>
                  <TableHead>{t('usersUi.status')}</TableHead>
                  <TableHead className='w-[120px]' />
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => {
                  const teamManager = managers.find(
                    (manager) => manager.id === team.managerId
                  )
                  return (
                    <TableRow key={team.id}>
                      <TableCell>
                        <div className='font-medium'>{team.name}</div>
                        {team.description ? (
                          <div className='text-xs text-muted-foreground'>
                            {team.description}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {teamManager
                          ? `${teamManager.firstName} ${teamManager.lastName}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={team.status} />
                      </TableCell>
                      <TableCell className='text-right'>
                        <Button
                          variant='ghost'
                          size='sm'
                          disabled={!canManage}
                          onClick={() =>
                            setDrawerState({ kind: 'team', record: team })
                          }
                        >
                          {t('common.update')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CatalogTableCard>
        </TabsContent>

        <TabsContent value='work-patterns'>
          <CatalogTableCard
            actionLabel={t('usersUi.newWorkPattern')}
            canManage={canManage}
            description={t('usersUi.workPatternsDescription')}
            onCreate={() => setDrawerState({ kind: 'work-pattern' })}
            title={t('usersUi.workPatterns')}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('usersUi.workPattern')}</TableHead>
                  <TableHead>{t('usersUi.weeklyHours')}</TableHead>
                  <TableHead>{t('usersUi.status')}</TableHead>
                  <TableHead className='w-[120px]' />
                </TableRow>
              </TableHeader>
              <TableBody>
                {workPatterns.map((workPattern) => (
                  <TableRow key={workPattern.id}>
                    <TableCell>
                      <div className='font-medium'>{workPattern.label}</div>
                      {workPattern.description ? (
                        <div className='text-xs text-muted-foreground'>
                          {workPattern.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{workPattern.weeklyHours} h</TableCell>
                    <TableCell>
                      <StatusBadge status={workPattern.status} />
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        variant='ghost'
                        size='sm'
                        disabled={!canManage}
                        onClick={() =>
                          setDrawerState({
                            kind: 'work-pattern',
                            record: workPattern,
                          })
                        }
                      >
                        {t('common.update')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CatalogTableCard>
        </TabsContent>

        <TabsContent value='managers' className='space-y-4'>
          <Card>
            <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <CardTitle>{t('usersUi.managers')}</CardTitle>
                <CardDescription>
                  {t('usersUi.managersDescriptionLong')}
                </CardDescription>
              </div>
              {canManage ? (
                <Button onClick={() => setOpen('add-manager')}>
                  {t('usersUi.addManager')}
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className='space-y-4'>
              {managers.length ? (
                <>
                  <SearchableSelect
                    value={effectiveSelectedManagerId}
                    onValueChange={(value) => {
                      setSelectedManagerId(value)
                      setDelegatedTeamsDraft(delegationsByManager[value] ?? [])
                    }}
                    placeholder={t('usersUi.selectManager')}
                    searchPlaceholder={t('usersUi.searchManagers')}
                    emptyLabel={t('usersUi.noManagersFound')}
                    options={managers.map((manager) => ({
                      label: `${manager.firstName} ${manager.lastName}`,
                      value: manager.id,
                    }))}
                  />
                  {selectedManager ? (
                    <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
                      <Card>
                        <CardHeader>
                          <CardTitle className='text-base'>
                            {t('usersUi.primaryTeamOwnership')}
                          </CardTitle>
                          <CardDescription>
                            {t('usersUi.primaryTeamOwnershipDescription')}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className='space-y-2'>
                          {teams
                            .filter(
                              (team) => team.managerId === selectedManager.id
                            )
                            .map((team) => (
                              <Badge
                                key={team.id}
                                variant='secondary'
                                className='mr-2 mb-2'
                              >
                                {team.name}
                              </Badge>
                            ))}
                          {teams.every(
                            (team) => team.managerId !== selectedManager.id
                          ) ? (
                            <EmptyState
                              className='min-h-32 border-0 bg-transparent'
                              title={t('usersUi.noPrimaryTeams')}
                              description={t(
                                'usersUi.noPrimaryTeamsDescription'
                              )}
                            />
                          ) : null}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className='text-base'>
                            {t('usersUi.delegatedTeams')}
                          </CardTitle>
                          <CardDescription>
                            {t('usersUi.delegatedTeamsDescription')}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className='space-y-3'>
                          <MultiSelectChips
                            values={currentDelegatedTeams}
                            options={availableTeamsToAdd}
                            placeholder={t('usersUi.addDelegatedTeam')}
                            emptyLabel={t('usersUi.noDelegatedTeams')}
                            clearLabel={t('usersUi.clearTeams')}
                            disabled={!canManage}
                            onChange={setDelegatedTeamsDraft}
                          />
                          <Button
                            disabled={!canManage}
                            onClick={() =>
                              void onSaveManagerTeams(
                                selectedManager.id,
                                currentDelegatedTeams
                              )
                            }
                          >
                            {t('usersUi.saveDelegation')}
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  ) : null}
                </>
              ) : (
                <EmptyState
                  className='min-h-56 border-0 bg-transparent'
                  title={t('usersUi.noManagersFound')}
                  description={t('usersUi.noManagersFoundDescription')}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CatalogDrawer
        key={
          drawerState
            ? `${drawerState.kind}-${drawerState.record?.id ?? 'new'}`
            : 'catalog-drawer'
        }
        canManage={canManage}
        managers={managers}
        open={!!drawerState}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDrawerState(null)
        }}
        onSave={onSaveRecord}
        state={drawerState}
      />
    </>
  )
}

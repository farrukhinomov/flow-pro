import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { canManageUsers } from '@/domain/access/access-control'
import { getLifecycleSummary } from '@/domain/users/lifecycle'
import {
  getEffectivePermissions,
  getPermissionCatalog,
  getRoleLabel,
} from '@/domain/users/permissions'
import type { EmployeeUser } from '@/domain/users/types'
import { useI18n } from '@/i18n'
import {
  Activity,
  CheckCircle2,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UsersRound,
  type LucideIcon,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfigDrawer } from '@/components/config-drawer'
import { EmptyState } from '@/components/flowpro/empty-state'
import {
  CardSectionSkeleton,
  MetricCardsSkeleton,
} from '@/components/flowpro/loading-skeletons'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { useCurrentViewer } from '../access/use-current-viewer'
import { OrganizationAdmin } from './components/organization-admin'
import { UsersDialogs } from './components/users-dialogs'
import { UsersPrimaryButtons } from './components/users-primary-buttons'
import { UsersProvider } from './components/users-provider'
import { UsersTable } from './components/users-table'
import { useOrganizationAdmin } from './hooks/use-organization-admin'
import { useUsersDirectory } from './hooks/use-users-directory'
import { translateLifecycleSummary } from './users-view-model'

const route = getRouteApi('/_authenticated/users/')

export function Users() {
  const { t } = useI18n()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const {
    deactivateUser,
    inviteUser,
    isLoading,
    reactivateUser,
    saveUser,
    syncMeta,
    users,
  } = useUsersDirectory()
  const viewer = useCurrentViewer()
  const canManage = canManageUsers(viewer)
  const organization = useOrganizationAdmin()
  const activeUsers = users.filter((user) => user.status === 'active').length
  const managers = users.filter((user) => user.role === 'manager').length
  const privilegedUsers = users.filter((user) =>
    ['superadmin', 'admin', 'hr'].includes(user.role)
  ).length
  const pendingInvites = users.filter(
    (user) => user.status === 'invited'
  ).length

  return (
    <UsersProvider
      deactivateUser={deactivateUser}
      inviteUser={inviteUser}
      reactivateUser={reactivateUser}
      saveUser={saveUser}
      managers={organization.managers}
      roleProfiles={organization.roleProfiles}
      teams={organization.teams}
      users={users}
      workPatterns={organization.workPatterns}
    >
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex min-w-0 flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <div className='mb-2 flex flex-wrap items-center gap-2'>
              <Badge variant='outline'>{t('usersUi.adminWorkspace')}</Badge>
              <Badge variant='outline' className='text-muted-foreground'>
                {t('usersUi.privacyAwareAccess')}
              </Badge>
              {!!syncMeta?.pendingCount && (
                <Badge variant='outline'>
                  {t('requestsPage.syncing', {
                    count: String(syncMeta.pendingCount),
                  })}
                </Badge>
              )}
            </div>
            <h2 className='text-2xl font-bold tracking-tight'>
              {t('usersUi.peopleAndAccess')}
            </h2>
            <p className='text-muted-foreground'>
              {t('usersUi.peopleAndAccessDescription')}
            </p>
          </div>
          {canManage && <UsersPrimaryButtons />}
        </div>

        {!canManage && (
          <Alert>
            <LockKeyhole className='h-4 w-4' />
            <AlertTitle>{t('usersUi.readOnlyAccess')}</AlertTitle>
            <AlertDescription>
              {t('usersUi.readOnlyAccessDescription')}
            </AlertDescription>
          </Alert>
        )}

        <Tabs
          defaultValue='directory'
          className='flex min-h-0 min-w-0 flex-1 flex-col gap-4'
        >
          <TabsList className='w-full sm:w-fit'>
            <TabsTrigger value='directory'>
              {t('usersUi.directory')}
            </TabsTrigger>
            <TabsTrigger value='overview'>
              {t('teamAvailabilityUi.overview')}
            </TabsTrigger>
            <TabsTrigger value='organization'>
              {t('usersUi.organization')}
            </TabsTrigger>
            <TabsTrigger value='permissions'>
              {t('usersUi.permissions')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value='directory' className='min-h-0 flex-1'>
            {isLoading ? (
              <CardSectionSkeleton blocks={6} className='min-h-72' />
            ) : (
              <UsersTable data={users} search={search} navigate={navigate} />
            )}
          </TabsContent>

          <TabsContent value='overview' className='space-y-4'>
            {isLoading ? (
              <MetricCardsSkeleton />
            ) : (
              <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
                <UserMetric
                  title={t('usersUi.activeEmployees')}
                  value={activeUsers}
                  description={t('usersUi.activeEmployeesDescription')}
                  icon={UsersRound}
                />
                <UserMetric
                  title={t('nav.levelManager')}
                  value={managers}
                  description={t('usersUi.managersDescription')}
                  icon={UserCheck}
                />
                <UserMetric
                  title={t('usersUi.privilegedAccess')}
                  value={privilegedUsers}
                  description={t('usersUi.privilegedAccessDescription')}
                  icon={ShieldCheck}
                />
                <UserMetric
                  title={t('usersUi.pendingInvites')}
                  value={pendingInvites}
                  description={t('usersUi.pendingInvitesDescription')}
                  icon={Activity}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value='organization' className='space-y-4'>
            <OrganizationAdmin
              canManage={canManage}
              delegationsByManager={organization.delegationsByManager}
              departments={organization.departments}
              isLoading={organization.isLoading}
              locations={organization.locations}
              managers={organization.managers}
              onSaveManagerTeams={organization.setManagerTeams}
              onSaveRecord={organization.saveRecord}
              roleProfiles={organization.roleProfiles}
              teams={organization.teams}
              workPatterns={organization.workPatterns}
            />
          </TabsContent>

          <TabsContent value='permissions' className='space-y-4'>
            {isLoading ? (
              <CardSectionSkeleton blocks={5} />
            ) : users.length > 0 ? (
              <EffectivePermissionsInspector users={users} />
            ) : (
              <EmptyState
                title={t('usersUi.noUsersAvailable')}
                description={t('usersUi.noUsersAvailableDescription')}
              />
            )}
          </TabsContent>
        </Tabs>
      </Main>

      <UsersDialogs />
    </UsersProvider>
  )
}

function EffectivePermissionsInspector({ users }: { users: EmployeeUser[] }) {
  const { locale, t } = useI18n()
  const [selectedUserId, setSelectedUserId] = useState(
    users.find((user) => user.status === 'active')?.id ?? users[0]?.id ?? ''
  )
  const selectedUser =
    users.find((user) => user.id === selectedUserId) ?? users[0]

  if (!selectedUser) return null

  const effective = getEffectivePermissions(selectedUser)
  const granted = effective.permissions.filter(
    (permission) => permission.granted
  )
  const blocked = effective.permissions.filter(
    (permission) => !permission.granted
  )
  const groups = Array.from(
    new Set(getPermissionCatalog().map((permission) => permission.group))
  )

  return (
    <Card>
      <CardHeader className='gap-3 lg:flex-row lg:items-start lg:justify-between'>
        <div className='space-y-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <CardTitle>{t('usersUi.effectivePermissions')}</CardTitle>
            <Badge variant='outline'>{t('usersUi.frontendContract')}</Badge>
            <Badge variant='outline'>{t('usersUi.signedInSession')}</Badge>
          </div>
          <CardDescription>
            {t('usersUi.effectivePermissionsDescription')}
          </CardDescription>
        </div>
        <Select value={selectedUser.id} onValueChange={setSelectedUserId}>
          <SelectTrigger
            className='w-full lg:w-72'
            aria-label={t('usersUi.inspectUser')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.firstName} {user.lastName} · {getRoleLabel(user.role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-3 md:grid-cols-3'>
          <div className='rounded-md border p-3'>
            <p className='text-xs text-muted-foreground'>
              {t('nav.levelUser')}
            </p>
            <p className='font-medium'>
              {selectedUser.firstName} {selectedUser.lastName}
            </p>
            <p className='text-xs text-muted-foreground'>
              {selectedUser.team} · {t(`usersUi.${selectedUser.status}`)}
            </p>
          </div>
          <div className='rounded-md border p-3'>
            <p className='text-xs text-muted-foreground'>
              {t('usersUi.grantedPermissions')}
            </p>
            <p className='font-medium'>
              {effective.grantedCount} of {effective.permissions.length}
            </p>
            <p className='text-xs text-muted-foreground'>
              {t('usersUi.sourceRoleLifecycle', { role: effective.role })}
            </p>
          </div>
          <div className='rounded-md border p-3'>
            <p className='text-xs text-muted-foreground'>
              {t('usersUi.lifecyclePolicy')}
            </p>
            <p className='font-medium'>
              {translateLifecycleSummary(
                getLifecycleSummary(selectedUser),
                locale,
                t
              )}
            </p>
          </div>
        </div>

        {effective.isLifecycleBlocked && (
          <Alert>
            <ShieldAlert className='h-4 w-4' />
            <AlertTitle>{t('usersUi.accessBlockedByLifecycle')}</AlertTitle>
            <AlertDescription>{effective.lifecycleNote}</AlertDescription>
          </Alert>
        )}

        <div className='grid gap-4 xl:grid-cols-[1.1fr_0.9fr]'>
          <div className='space-y-3'>
            {groups.map((group) => {
              const groupPermissions = effective.permissions.filter(
                (permission) => permission.group === group
              )

              return (
                <div key={group} className='rounded-md border'>
                  <div className='flex items-center justify-between px-3 py-2'>
                    <p className='text-sm font-medium'>{group}</p>
                    <Badge variant='secondary'>
                      {
                        groupPermissions.filter(
                          (permission) => permission.granted
                        ).length
                      }
                      /{groupPermissions.length}
                    </Badge>
                  </div>
                  <Separator />
                  <div className='divide-y'>
                    {groupPermissions.map((permission) => (
                      <div
                        key={permission.key}
                        className='grid gap-2 px-3 py-2 sm:grid-cols-[1fr_auto]'
                      >
                        <div>
                          <p className='text-sm font-medium'>
                            {permission.label}
                          </p>
                          <p className='text-xs text-muted-foreground'>
                            {permission.description}
                          </p>
                        </div>
                        <Badge
                          variant={permission.granted ? 'default' : 'outline'}
                          className='h-fit justify-self-start sm:justify-self-end'
                        >
                          {permission.granted
                            ? t('usersUi.granted')
                            : t('usersUi.blocked')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div className='space-y-3'>
            <div className='rounded-md border p-3'>
              <div className='mb-3 flex items-center gap-2'>
                <CheckCircle2 className='h-4 w-4 text-emerald-600' />
                <p className='text-sm font-medium'>
                  {t('usersUi.whatUserCanDo')}
                </p>
              </div>
              <div className='flex flex-wrap gap-2'>
                {granted.length ? (
                  granted.map((permission) => (
                    <Badge key={permission.key} variant='secondary'>
                      {permission.label}
                    </Badge>
                  ))
                ) : (
                  <p className='text-sm text-muted-foreground'>
                    {t('usersUi.noActivePermissions')}
                  </p>
                )}
              </div>
            </div>

            <div className='rounded-md border p-3'>
              <div className='mb-3 flex items-center gap-2'>
                <LockKeyhole className='h-4 w-4 text-muted-foreground' />
                <p className='text-sm font-medium'>
                  {t('usersUi.whyActionsHidden')}
                </p>
              </div>
              <div className='space-y-2'>
                {blocked.slice(0, 7).map((permission) => (
                  <div key={permission.key} className='text-sm'>
                    <p className='font-medium'>{permission.label}</p>
                    <p className='text-xs text-muted-foreground'>
                      {permission.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function UserMetric({
  description,
  icon: Icon,
  title,
  value,
}: {
  description: string
  icon: LucideIcon
  title: string
  value: number
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between space-y-0 pb-2'>
        <div>
          <CardDescription>{title}</CardDescription>
          <CardTitle className='mt-1 text-2xl font-semibold'>{value}</CardTitle>
        </div>
        <div className='rounded-md border bg-muted p-2'>
          <Icon className='h-4 w-4 text-muted-foreground' />
        </div>
      </CardHeader>
      <CardContent>
        <p className='text-xs text-muted-foreground'>{description}</p>
      </CardContent>
    </Card>
  )
}

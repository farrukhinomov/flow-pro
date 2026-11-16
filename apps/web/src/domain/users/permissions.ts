import { tStatic } from '@/i18n/static'
import type { EmployeeUser, UserRole } from './types'

export type PermissionKey =
  | 'attendance.clock.self'
  | 'attendance.correct.self'
  | 'requests.create.self'
  | 'requests.approve.team'
  | 'requests.view.full'
  | 'planning.view.team'
  | 'planning.manage.capacity'
  | 'timesheet.view.self'
  | 'timesheet.view.team'
  | 'timesheet.approve.team'
  | 'timesheet.export.payroll'
  | 'users.view'
  | 'users.manage'
  | 'users.deactivate'
  | 'users.permissions.inspect'
  | 'policies.manage'
  | 'audit.view.full'
  | 'sync.manage.local'

export type PermissionCatalogItem = {
  key: PermissionKey
  label: string
  description: string
  group: string
}

type PermissionCatalogEntry = {
  key: PermissionKey
  labelKey: string
  descriptionKey: string
  groupKey: string
}

export type EffectivePermission = PermissionCatalogItem & {
  granted: boolean
  source: 'role' | 'superadmin' | 'lifecycle-block'
  reason: string
}

export type EffectivePermissions = {
  role: UserRole
  status: EmployeeUser['status']
  isLifecycleBlocked: boolean
  grantedCount: number
  permissions: EffectivePermission[]
  lifecycleNote: string
}

const allPermissionKeys: PermissionKey[] = [
  'attendance.clock.self',
  'attendance.correct.self',
  'requests.create.self',
  'requests.approve.team',
  'requests.view.full',
  'planning.view.team',
  'planning.manage.capacity',
  'timesheet.view.self',
  'timesheet.view.team',
  'timesheet.approve.team',
  'timesheet.export.payroll',
  'users.view',
  'users.manage',
  'users.deactivate',
  'users.permissions.inspect',
  'policies.manage',
  'audit.view.full',
  'sync.manage.local',
]

const permissionCatalogBase: PermissionCatalogEntry[] = [
  {
    key: 'attendance.clock.self',
    labelKey: 'usersUi.permissionLabels.clockOwnTime',
    descriptionKey: 'usersUi.permissionDescriptions.clockOwnTime',
    groupKey: 'usersUi.permissionGroups.attendance',
  },
  {
    key: 'attendance.correct.self',
    labelKey: 'usersUi.permissionLabels.requestOwnCorrections',
    descriptionKey: 'usersUi.permissionDescriptions.requestOwnCorrections',
    groupKey: 'usersUi.permissionGroups.attendance',
  },
  {
    key: 'requests.create.self',
    labelKey: 'usersUi.permissionLabels.createOwnRequests',
    descriptionKey: 'usersUi.permissionDescriptions.createOwnRequests',
    groupKey: 'usersUi.permissionGroups.requests',
  },
  {
    key: 'requests.approve.team',
    labelKey: 'usersUi.permissionLabels.approveTeamRequests',
    descriptionKey: 'usersUi.permissionDescriptions.approveTeamRequests',
    groupKey: 'usersUi.permissionGroups.requests',
  },
  {
    key: 'requests.view.full',
    labelKey: 'usersUi.permissionLabels.viewFullRequestDetail',
    descriptionKey: 'usersUi.permissionDescriptions.viewFullRequestDetail',
    groupKey: 'usersUi.permissionGroups.requests',
  },
  {
    key: 'planning.view.team',
    labelKey: 'usersUi.permissionLabels.viewTeamPlanning',
    descriptionKey: 'usersUi.permissionDescriptions.viewTeamPlanning',
    groupKey: 'usersUi.permissionGroups.planning',
  },
  {
    key: 'planning.manage.capacity',
    labelKey: 'usersUi.permissionLabels.manageCapacityRules',
    descriptionKey: 'usersUi.permissionDescriptions.manageCapacityRules',
    groupKey: 'usersUi.permissionGroups.planning',
  },
  {
    key: 'timesheet.view.self',
    labelKey: 'usersUi.permissionLabels.viewOwnTimesheet',
    descriptionKey: 'usersUi.permissionDescriptions.viewOwnTimesheet',
    groupKey: 'usersUi.permissionGroups.timesheets',
  },
  {
    key: 'timesheet.view.team',
    labelKey: 'usersUi.permissionLabels.viewTeamTimesheets',
    descriptionKey: 'usersUi.permissionDescriptions.viewTeamTimesheets',
    groupKey: 'usersUi.permissionGroups.timesheets',
  },
  {
    key: 'timesheet.approve.team',
    labelKey: 'usersUi.permissionLabels.approveTeamTimesheets',
    descriptionKey: 'usersUi.permissionDescriptions.approveTeamTimesheets',
    groupKey: 'usersUi.permissionGroups.timesheets',
  },
  {
    key: 'timesheet.export.payroll',
    labelKey: 'usersUi.permissionLabels.exportPayrollData',
    descriptionKey: 'usersUi.permissionDescriptions.exportPayrollData',
    groupKey: 'usersUi.permissionGroups.timesheets',
  },
  {
    key: 'users.view',
    labelKey: 'usersUi.permissionLabels.viewPeopleDirectory',
    descriptionKey: 'usersUi.permissionDescriptions.viewPeopleDirectory',
    groupKey: 'usersUi.permissionGroups.people',
  },
  {
    key: 'users.manage',
    labelKey: 'usersUi.permissionLabels.manageUsers',
    descriptionKey: 'usersUi.permissionDescriptions.manageUsers',
    groupKey: 'usersUi.permissionGroups.people',
  },
  {
    key: 'users.deactivate',
    labelKey: 'usersUi.permissionLabels.deactivateUsers',
    descriptionKey: 'usersUi.permissionDescriptions.deactivateUsers',
    groupKey: 'usersUi.permissionGroups.people',
  },
  {
    key: 'users.permissions.inspect',
    labelKey: 'usersUi.permissionLabels.inspectEffectivePermissions',
    descriptionKey:
      'usersUi.permissionDescriptions.inspectEffectivePermissions',
    groupKey: 'usersUi.permissionGroups.people',
  },
  {
    key: 'policies.manage',
    labelKey: 'usersUi.permissionLabels.managePolicies',
    descriptionKey: 'usersUi.permissionDescriptions.managePolicies',
    groupKey: 'usersUi.permissionGroups.platform',
  },
  {
    key: 'audit.view.full',
    labelKey: 'usersUi.permissionLabels.viewFullAudit',
    descriptionKey: 'usersUi.permissionDescriptions.viewFullAudit',
    groupKey: 'usersUi.permissionGroups.platform',
  },
  {
    key: 'sync.manage.local',
    labelKey: 'usersUi.permissionLabels.manageLocalSyncData',
    descriptionKey: 'usersUi.permissionDescriptions.manageLocalSyncData',
    groupKey: 'usersUi.permissionGroups.platform',
  },
]

export function getPermissionCatalog() {
  return permissionCatalogBase.map<PermissionCatalogItem>((item) => ({
    key: item.key,
    label: tStatic(item.labelKey),
    description: tStatic(item.descriptionKey),
    group: tStatic(item.groupKey),
  }))
}

const baseEmployeePermissions: PermissionKey[] = [
  'attendance.clock.self',
  'attendance.correct.self',
  'requests.create.self',
  'timesheet.view.self',
]

export const rolePermissions: Record<UserRole, PermissionKey[]> = {
  employee: baseEmployeePermissions,
  manager: [
    ...baseEmployeePermissions,
    'requests.approve.team',
    'planning.view.team',
    'planning.manage.capacity',
    'timesheet.view.team',
    'timesheet.approve.team',
  ],
  hr: [
    ...baseEmployeePermissions,
    'requests.view.full',
    'planning.view.team',
    'timesheet.view.team',
    'timesheet.export.payroll',
    'users.view',
    'users.manage',
    'users.deactivate',
    'users.permissions.inspect',
    'policies.manage',
    'audit.view.full',
  ],
  admin: [
    ...baseEmployeePermissions,
    'planning.view.team',
    'planning.manage.capacity',
    'users.view',
    'users.manage',
    'users.deactivate',
    'users.permissions.inspect',
    'policies.manage',
    'audit.view.full',
    'sync.manage.local',
  ],
  superadmin: allPermissionKeys,
}

export function getRolePermissions(role: UserRole) {
  return new Set(rolePermissions[role])
}

export function hasPermission(
  userOrRole: EmployeeUser | UserRole,
  permission: PermissionKey
) {
  if (typeof userOrRole === 'string') {
    return getRolePermissions(userOrRole).has(permission)
  }

  return getEffectivePermissions(userOrRole).permissions.some(
    (item) => item.key === permission && item.granted
  )
}

export function getEffectivePermissions(
  user: EmployeeUser
): EffectivePermissions {
  const roleGrants = getRolePermissions(user.role)
  const isLifecycleBlocked = user.status !== 'active'

  const permissions = getPermissionCatalog().map<EffectivePermission>(
    (item) => {
      const roleGranted = roleGrants.has(item.key)

      if (isLifecycleBlocked) {
        return {
          ...item,
          granted: false,
          source: 'lifecycle-block',
          reason: getLifecycleBlockReason(user),
        }
      }

      return {
        ...item,
        granted: roleGranted,
        source:
          user.role === 'superadmin' && roleGranted ? 'superadmin' : 'role',
        reason: roleGranted
          ? tStatic('usersUi.permissionReasons.roleGrants', {
              role: getRoleLabel(user.role),
            })
          : tStatic('usersUi.permissionReasons.roleDoesNotInclude', {
              role: getRoleLabel(user.role),
            }),
      }
    }
  )

  return {
    role: user.role,
    status: user.status,
    isLifecycleBlocked,
    grantedCount: permissions.filter((item) => item.granted).length,
    permissions,
    lifecycleNote: isLifecycleBlocked
      ? getLifecycleBlockReason(user)
      : tStatic('usersUi.permissionLifecycle.activeUsersReceivePermissions'),
  }
}

function getLifecycleBlockReason(user: EmployeeUser) {
  if (user.status === 'invited') {
    return tStatic('usersUi.permissionLifecycle.invited')
  }

  if (user.status === 'suspended') {
    return tStatic('usersUi.permissionLifecycle.suspended')
  }

  return tStatic('usersUi.permissionLifecycle.inactive')
}

export function getRoleLabel(role: UserRole) {
  if (role === 'employee') return tStatic('nav.levelUser')
  if (role === 'manager') return tStatic('nav.levelManager')
  if (role === 'hr') return tStatic('usersUi.hrRole')
  if (role === 'admin') return tStatic('nav.levelAdministrator')
  return tStatic('usersUi.superadminRole')
}

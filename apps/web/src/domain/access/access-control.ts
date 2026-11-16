import type { ViewerRole, VisibilityLevel } from '@/domain/attendance/types'
import type { EmployeeRequest } from '@/domain/requests/types'
import {
  hasPermission,
  getRoleLabel as getPermissionRoleLabel,
} from '@/domain/users/permissions'
import type { EmployeeUser, UserRole } from '@/domain/users/types'
import { tStatic } from '@/i18n/static'

export type AppViewer = {
  id: string
  name: string
  role: UserRole
  employeeId: string
  managedTeam?: string
  delegatedTeams?: string[]
}

export type DataScope =
  'own-details' | 'availability-state' | 'team-operational' | 'full-audit'

export const defaultViewer: AppViewer = {
  id: 'viewer-marta-admin',
  name: 'Marta Lindgren',
  role: 'superadmin',
  employeeId: 'usr-marta-lindgren',
  managedTeam: 'Management',
}

export function getRoleLabel(role: UserRole) {
  return getPermissionRoleLabel(role)
}

export function getPermissionMessage(
  capability: 'manage-users' | 'manage-policies' | 'view-audit' | 'team-detail'
) {
  return tStatic(`accessUi.permissionMessages.${capability}`)
}

export function getViewerRole(viewer: AppViewer): ViewerRole {
  if (viewer.role === 'employee') return 'employee'
  if (viewer.role === 'manager') return 'manager'

  return 'admin'
}

export function canManageUsers(viewer: AppViewer) {
  return hasPermission(viewer.role, 'users.manage')
}

export function canManageAttendancePolicies(viewer: AppViewer) {
  return hasPermission(viewer.role, 'policies.manage')
}

export function canViewTeamPlanning(viewer: AppViewer) {
  return hasPermission(viewer.role, 'planning.view.team')
}

export function canViewFullAudit(viewer: AppViewer) {
  return hasPermission(viewer.role, 'audit.view.full')
}

export function canViewReports(viewer: AppViewer) {
  return (
    hasPermission(viewer.role, 'timesheet.view.team') ||
    hasPermission(viewer.role, 'timesheet.export.payroll') ||
    hasPermission(viewer.role, 'audit.view.full')
  )
}

export function canViewEmployeeTimesheet({
  employee,
  viewer,
}: {
  employee: EmployeeUser
  viewer: AppViewer
}) {
  if (canViewFullAudit(viewer)) return true
  if (viewer.employeeId === employee.id) return true

  return (
    hasPermission(viewer.role, 'timesheet.view.team') &&
    viewer.role === 'manager' &&
    viewer.managedTeam === employee.team
  )
}

export function getTimesheetVisibleEmployees({
  employees,
  viewer,
}: {
  employees: EmployeeUser[]
  viewer: AppViewer
}) {
  if (canViewFullAudit(viewer)) return employees

  return employees.filter((employee) =>
    canViewEmployeeTimesheet({ employee, viewer })
  )
}

export function canSignEmployeeTimesheet({
  employee,
  viewer,
}: {
  employee: EmployeeUser
  viewer: AppViewer
}) {
  if (canViewFullAudit(viewer)) return true

  return (
    hasPermission(viewer.role, 'timesheet.approve.team') &&
    viewer.role === 'manager' &&
    viewer.managedTeam === employee.team &&
    viewer.employeeId !== employee.id
  )
}

export function getDataScope({
  employee,
  viewer,
}: {
  employee: EmployeeUser
  viewer: AppViewer
}): DataScope {
  if (canViewFullAudit(viewer)) return 'full-audit'
  if (viewer.employeeId === employee.id) return 'own-details'
  if (viewer.role === 'manager' && viewer.managedTeam === employee.team) {
    return 'team-operational'
  }

  return 'availability-state'
}

export function getVisibilityForScope({
  managerVisibility,
  scope,
  teammateVisibility,
}: {
  managerVisibility?: VisibilityLevel
  scope: DataScope
  teammateVisibility?: VisibilityLevel
}): VisibilityLevel {
  if (scope === 'full-audit' || scope === 'own-details') return 'full'
  if (scope === 'team-operational') return managerVisibility ?? 'operational'

  return teammateVisibility ?? 'state-only'
}

export function canSeeRequestReason({
  employee,
  request,
  viewer,
}: {
  employee: EmployeeUser
  request: EmployeeRequest
  viewer: AppViewer
}) {
  const scope = getDataScope({ employee, viewer })

  return (
    scope === 'full-audit' ||
    scope === 'own-details' ||
    (scope === 'team-operational' && request.status === 'approved')
  )
}

export function getViewerManagedTeams(viewer: AppViewer) {
  const teams = new Set<string>()
  if (viewer.managedTeam) teams.add(viewer.managedTeam)
  for (const team of viewer.delegatedTeams ?? []) teams.add(team)
  return Array.from(teams)
}

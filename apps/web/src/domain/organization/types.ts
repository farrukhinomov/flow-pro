import type { UserRole } from '@/domain/users/types'

export type CatalogStatus = 'active' | 'archived'

type CatalogBase = {
  id: string
  description?: string
  status: CatalogStatus
  createdAt: Date
  updatedAt: Date
}

export type RoleProfile = CatalogBase & {
  kind: 'role-profile'
  label: string
  baseRole: UserRole
}

export type TeamCatalog = CatalogBase & {
  kind: 'team'
  code?: string
  name: string
  managerId?: string
}

export type WorkPatternCatalog = CatalogBase & {
  kind: 'work-pattern'
  label: string
  weeklyHours: number
}

export type DepartmentCatalog = CatalogBase & {
  kind: 'department'
  code: string
  name: string
}

export type LocationCatalog = CatalogBase & {
  kind: 'location'
  code: string
  name: string
  timeZoneId: string
}

export type OrganizationCatalogRecord =
  | DepartmentCatalog
  | LocationCatalog
  | RoleProfile
  | TeamCatalog
  | WorkPatternCatalog

export type EmploymentContractRecord = {
  id?: string | null
  employeeId: string
  effectiveFrom: string
  effectiveTo?: string | null
  weeklyHours: number
  timeZoneId: string
  createdAt: Date
  updatedAt: Date
}

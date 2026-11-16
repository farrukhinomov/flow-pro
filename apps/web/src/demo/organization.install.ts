import { getAllFromStore, putManyInStore } from '@/data/local/db'
import type {
  OrganizationCatalogRecord,
  RoleProfile,
  TeamCatalog,
  WorkPatternCatalog,
} from '@/domain/organization/types'
import type { EmployeeUser, UserRole } from '@/domain/users/types'
import { tStatic } from '@/i18n/static'
import { seedUsers } from './people'

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Demo organization catalogs, derived from the demo directory.
 *
 * The repository used to fall back to the fixtures whenever the real directory
 * was empty, which treated "a workspace with one founder" as "data missing" and
 * gave a genuinely new tenant an org chart of invented people.
 */

function buildDefaultRoleProfiles(now: Date): RoleProfile[] {
  const profiles: Array<{
    baseRole: UserRole
    label: string
    description: string
  }> = [
    {
      baseRole: 'superadmin',
      label: tStatic('roles.superadmin'),
      description: tStatic('usersUi.roleProfileDescriptions.superadmin'),
    },
    {
      baseRole: 'admin',
      label: tStatic('roles.admin'),
      description: tStatic('usersUi.roleProfileDescriptions.admin'),
    },
    {
      baseRole: 'hr',
      label: tStatic('roles.hr'),
      description: tStatic('usersUi.roleProfileDescriptions.hr'),
    },
    {
      baseRole: 'manager',
      label: tStatic('roles.manager'),
      description: tStatic('usersUi.roleProfileDescriptions.manager'),
    },
    {
      baseRole: 'employee',
      label: tStatic('roles.employee'),
      description: tStatic('usersUi.roleProfileDescriptions.employee'),
    },
  ]

  return profiles.map((profile) => ({
    id: `role-profile-${profile.baseRole}`,
    kind: 'role-profile' as const,
    label: profile.label,
    baseRole: profile.baseRole,
    description: profile.description,
    status: 'active' as const,
    createdAt: now,
    updatedAt: now,
  }))
}

export async function installDemoOrganization() {
  const existing = await getAllFromStore<OrganizationCatalogRecord>(
    'organizationCatalogs'
  )
  const now = new Date()
  const users = await getAllFromStore<EmployeeUser>('employeeUsers')
  const sourceUsers = users.length > 0 ? users : seedUsers

  if (existing.length === 0) {
    const teamNameToManagerId = new Map<string, string>()
    const usersByFullName = new Map(
      sourceUsers.map((user) => [`${user.firstName} ${user.lastName}`, user.id])
    )

    sourceUsers.forEach((user) => {
      if (user.manager && !teamNameToManagerId.has(user.team)) {
        const managerId = usersByFullName.get(user.manager)
        if (managerId) teamNameToManagerId.set(user.team, managerId)
      }
    })

    const teamRecords: TeamCatalog[] = Array.from(
      new Set(sourceUsers.map((user) => user.team))
    ).map((name) => ({
      id: `team-${slugify(name)}`,
      kind: 'team',
      name,
      managerId: teamNameToManagerId.get(name),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }))

    const workPatterns: WorkPatternCatalog[] = Array.from(
      new Set(sourceUsers.map((user) => user.workPattern))
    ).map((label) => ({
      id: `work-pattern-${slugify(label)}`,
      kind: 'work-pattern',
      label,
      weeklyHours: label.toLowerCase().includes('part-time') ? 24 : 40,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }))

    await putManyInStore('organizationCatalogs', [
      ...buildDefaultRoleProfiles(now),
      ...teamRecords,
      ...workPatterns,
    ])
    return
  }

  const byId = new Set(existing.map((item) => item.id))
  const missingRoleProfiles = buildDefaultRoleProfiles(now).filter(
    (profile) => !byId.has(profile.id)
  )
  const missingTeams = Array.from(new Set(sourceUsers.map((user) => user.team)))
    .map((name) => ({
      id: `team-${slugify(name)}`,
      kind: 'team' as const,
      name,
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
    }))
    .filter((team) => !byId.has(team.id))
  const missingWorkPatterns = Array.from(
    new Set(sourceUsers.map((user) => user.workPattern))
  )
    .map((label) => ({
      id: `work-pattern-${slugify(label)}`,
      kind: 'work-pattern' as const,
      label,
      weeklyHours: label.toLowerCase().includes('part-time') ? 24 : 40,
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
    }))
    .filter((workPattern) => !byId.has(workPattern.id))

  const missingRecords = [
    ...missingRoleProfiles,
    ...missingTeams,
    ...missingWorkPatterns,
  ]

  if (missingRecords.length > 0) {
    await putManyInStore('organizationCatalogs', missingRecords)
  }
}

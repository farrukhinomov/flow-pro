import type { OrganizationCatalogRecord } from '@/domain/organization/types'
import type { ManagerDelegation } from '@/domain/users/delegations'
import type { UserRole } from '@/domain/users/types'
import { FlowProApiError, flowProApi } from './http-client'

type ApiCatalogStatus = 'active' | 'archived'
type ApiCatalogKind =
  'department' | 'location' | 'role-profile' | 'team' | 'work-pattern'

type ApiOrganizationCatalogRecord = {
  id: string
  kind: ApiCatalogKind
  code?: string | null
  label?: string | null
  name?: string | null
  description?: string | null
  status: ApiCatalogStatus
  baseRole?: UserRole | null
  managerId?: string | null
  timeZoneId?: string | null
  weeklyHours?: number | null
  createdAt: string
  updatedAt: string
}

type ApiManagerDelegation = Omit<
  ManagerDelegation,
  'createdAt' | 'updatedAt'
> & {
  createdAt: string
  updatedAt: string
}

type ApiOrganizationCatalogPage = {
  items: ApiOrganizationCatalogRecord[]
  delegations: ApiManagerDelegation[]
}

type ApiManagerDelegationPage = {
  items: ApiManagerDelegation[]
}

export async function listOrganizationCatalogWorkflow() {
  const response = await flowProApi.get<ApiOrganizationCatalogPage>(
    '/directory/organization-catalogs'
  )

  return {
    delegations: response.data.delegations.map(mapDelegationFromApi),
    records: response.data.items.map(mapRecordFromApi),
  }
}

export async function saveOrganizationRecordWorkflow(
  record: OrganizationCatalogRecord
) {
  const response = await flowProApi.put<ApiOrganizationCatalogRecord>(
    `/directory/organization-catalogs/${encodeURIComponent(record.id)}`,
    mapRecordToApi(record)
  )

  return mapRecordFromApi(response.data)
}

export async function setManagerDelegationsWorkflow({
  managerId,
  teams,
}: {
  managerId: string
  teams: string[]
}) {
  const response = await flowProApi.put<ApiManagerDelegationPage>(
    `/directory/organization-catalogs/manager-delegations/${encodeURIComponent(managerId)}`,
    { teams }
  )

  return response.data.items.map(mapDelegationFromApi)
}

export function shouldFallbackToLocalOrganization(error: unknown) {
  return (
    !(error instanceof FlowProApiError) ||
    error.status === undefined ||
    error.status >= 500
  )
}

function mapRecordToApi(
  record: OrganizationCatalogRecord
): ApiOrganizationCatalogRecord {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function mapRecordFromApi(
  record: ApiOrganizationCatalogRecord
): OrganizationCatalogRecord {
  const base = {
    createdAt: new Date(record.createdAt),
    description: record.description ?? undefined,
    id: record.id,
    status: record.status,
    updatedAt: new Date(record.updatedAt),
  }

  if (record.kind === 'role-profile') {
    return {
      ...base,
      baseRole: record.baseRole ?? 'employee',
      kind: 'role-profile',
      label: record.label ?? '',
    }
  }

  if (record.kind === 'team') {
    return {
      ...base,
      code: record.code ?? undefined,
      kind: 'team',
      managerId: record.managerId ?? undefined,
      name: record.name ?? '',
    }
  }

  if (record.kind === 'department') {
    return {
      ...base,
      code: record.code ?? '',
      kind: 'department',
      name: record.name ?? '',
    }
  }

  if (record.kind === 'location') {
    return {
      ...base,
      code: record.code ?? '',
      kind: 'location',
      name: record.name ?? '',
      timeZoneId: record.timeZoneId ?? '',
    }
  }

  return {
    ...base,
    kind: 'work-pattern',
    label: record.label ?? '',
    weeklyHours: record.weeklyHours ?? 0,
  }
}

function mapDelegationFromApi(
  delegation: ApiManagerDelegation
): ManagerDelegation {
  return {
    ...delegation,
    createdAt: delegation.createdAt,
    updatedAt: delegation.updatedAt,
  }
}

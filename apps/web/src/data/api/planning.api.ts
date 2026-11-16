import type { PlanningPackage, PlanningPerson } from '@/domain/planning/types'
import type { EmployeeUser } from '@/domain/users/types'
import { FlowProApiError, flowProApi } from './http-client'

type ApiEmployeeUser = Omit<
  EmployeeUser,
  | 'createdAt'
  | 'deactivatedAt'
  | 'lastSeenAt'
  | 'nextReviewAt'
  | 'retentionUntil'
  | 'updatedAt'
> & {
  createdAt: string
  deactivatedAt?: string | null
  lastSeenAt?: string | null
  nextReviewAt?: string | null
  retentionUntil?: string | null
  updatedAt: string
}

type ApiPlanningPerson = Omit<PlanningPerson, 'user'> & {
  user: ApiEmployeeUser
}

export type { PlanningPackage }

type ApiPlanningPackage = Omit<PlanningPackage, 'people'> & {
  people: ApiPlanningPerson[]
}

export async function getPlanningPackageWorkflow(periodMonth: string) {
  const response = await flowProApi.get<ApiPlanningPackage>(
    `/planning-workflows/${encodeURIComponent(periodMonth)}`
  )

  return mapPlanningPackage(response.data)
}

export function shouldFallbackToLocalPlanning(error: unknown) {
  return (
    !(error instanceof FlowProApiError) ||
    error.status === undefined ||
    error.status >= 500
  )
}

function mapPlanningPackage(
  planningPackage: ApiPlanningPackage
): PlanningPackage {
  return {
    ...planningPackage,
    people: planningPackage.people.map((person) => ({
      ...person,
      user: mapEmployee(person.user),
    })),
  }
}

function mapEmployee(employee: ApiEmployeeUser): EmployeeUser {
  return {
    ...employee,
    createdAt: new Date(employee.createdAt),
    deactivatedAt: employee.deactivatedAt
      ? new Date(employee.deactivatedAt)
      : undefined,
    lastSeenAt: employee.lastSeenAt ? new Date(employee.lastSeenAt) : undefined,
    nextReviewAt: employee.nextReviewAt
      ? new Date(employee.nextReviewAt)
      : undefined,
    retentionUntil: employee.retentionUntil
      ? new Date(employee.retentionUntil)
      : undefined,
    updatedAt: new Date(employee.updatedAt),
  }
}

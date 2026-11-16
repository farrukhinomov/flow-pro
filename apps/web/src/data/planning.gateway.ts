import { eachDayOfInterval, format, parseISO } from 'date-fns'
import { listAttendanceTypes } from '@/data/local/attendance.repo'
import { cachePlanningPackage } from '@/data/local/planning-packages.repo'
import { listEmployeeRequests } from '@/data/local/requests.repo'
import { listEmployeeUsers } from '@/data/local/users.repo'
import { listEmployeeUsersBackendFirst } from '@/data/users.gateway'
import {
  defaultViewer,
  getDataScope,
  getVisibilityForScope,
  type AppViewer,
} from '@/domain/access/access-control'
import type {
  AttendanceStatusType,
  VisibilityLevel,
} from '@/domain/attendance/types'
import type { PlanningEntry, PlanningPerson } from '@/domain/planning/types'
import type { EmployeeRequest } from '@/domain/requests/types'
import type { EmployeeUser } from '@/domain/users/types'
import { optionalSource } from '@/lib/optional-source'
import {
  getPlanningPackageWorkflow,
  shouldFallbackToLocalPlanning,
  type PlanningPackage,
} from './api/planning.api'

function getTypeMap(types: AttendanceStatusType[]) {
  return new Map(types.map((type) => [type.code, type]))
}

function isPlanningRequest(request: EmployeeRequest) {
  return (
    request.kind !== 'booking-correction' &&
    request.status !== 'cancelled' &&
    request.status !== 'rejected' &&
    !!request.statusCode
  )
}

function requestBelongsToUser(request: EmployeeRequest, user: EmployeeUser) {
  const fullName = `${user.firstName} ${user.lastName}`.toLowerCase()

  return (
    request.employeeId === user.id ||
    request.employeeName.toLowerCase() === fullName
  )
}

function getEntryFromRequest(
  request: EmployeeRequest,
  type: AttendanceStatusType | undefined,
  visibility: VisibilityLevel
): PlanningEntry[] {
  const days = eachDayOfInterval({
    start: parseISO(request.fromDate),
    end: parseISO(request.toDate),
  })
  const isSensitive = type?.category === 'sickness'

  return days.map((day) => ({
    date: format(day, 'yyyy-MM-dd'),
    code: request.statusCode,
    label:
      visibility === 'full' || visibility === 'operational'
        ? (request.statusLabel ?? request.subtype)
        : undefined,
    color: type?.color,
    category: type?.category,
    visibility,
    isAnon: isSensitive || visibility === 'hidden',
    isPending: request.status === 'submitted',
  }))
}

export async function getPlanningPackageBackendFirst(
  periodMonth: string,
  viewer: AppViewer = defaultViewer
): Promise<PlanningPackage> {
  try {
    const planningPackage = await getPlanningPackageWorkflow(periodMonth)
    await cachePlanningPackage(planningPackage)
    return planningPackage
  } catch (error) {
    if (!shouldFallbackToLocalPlanning(error)) {
      throw error
    }

    return buildLocalPlanningPackage(periodMonth, viewer)
  }
}

export async function buildLocalPlanningPackage(
  periodMonth: string,
  viewer: AppViewer
): Promise<PlanningPackage> {
  const [attendanceTypes, requests, users] = await Promise.all([
    optionalSource(listAttendanceTypes(), [], 'absence types'),
    listEmployeeRequests(),
    optionalSource(
      listEmployeeUsersBackendFirst(),
      () => listEmployeeUsers(),
      'people'
    ),
  ])
  const typeMap = getTypeMap(attendanceTypes)
  const people = users.map<PlanningPerson>((user) => {
    const scope = getDataScope({ employee: user, viewer })
    const entries = requests
      .filter(
        (request) =>
          requestBelongsToUser(request, user) && isPlanningRequest(request)
      )
      .flatMap((request) => {
        const type = typeMap.get(request.statusCode ?? '')
        const visibility = getVisibilityForScope({
          managerVisibility: type?.managerVisibility,
          scope,
          teammateVisibility: type?.teammateVisibility,
        })

        return getEntryFromRequest(request, type, visibility)
      })

    return {
      id: user.id,
      name: `${user.lastName}, ${user.firstName}`,
      displayName: `${user.firstName} ${user.lastName}`,
      role: user.workPattern,
      team: user.team,
      entries,
      user,
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    people,
    periodMonth,
    requests,
  }
}

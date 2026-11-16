import {
  getAttendancePolicyConfig,
  listAllClockEvents,
} from '@/data/local/attendance.repo'
import { getCachedPlanningPackage } from '@/data/local/planning-packages.repo'
import { getCachedReportsPackage } from '@/data/local/reports-packages.repo'
import { listEmployeeRequests } from '@/data/local/requests.repo'
import {
  getTimesheetApproval,
  listAllTimesheetApprovals,
} from '@/data/local/timesheet.repo'
import { listEmployeeUsers } from '@/data/local/users.repo'
import {
  buildLocalPlanningPackage,
  getPlanningPackageBackendFirst,
} from '@/data/planning.gateway'
import { getReportsPackageBackendFirst } from '@/data/reports.gateway'
import { getTimesheetApprovalBackendFirst } from '@/data/timesheet.gateway'
import { listEmployeeUsersBackendFirst } from '@/data/users.gateway'
import { defaultViewer, type AppViewer } from '@/domain/access/access-control'
import type { MonthlyTimesheetApproval } from '@/domain/attendance/types'
import type { PlanningPackage } from '@/domain/planning/types'
import {
  buildReportsPackage,
  type ReportsPackage,
} from '@/domain/reports/payroll'
import type { EmployeeUser } from '@/domain/users/types'
import {
  applicationStoreHydration,
  projectionHydrationModules,
  type ProjectionHydrationModule,
} from './application-store-hydration'

export type ApplicationStoreSnapshot<T> = {
  data: T
  source: 'local' | 'remote'
}

export type ReadThroughOptions<T> = {
  local: () => Promise<T>
  onSnapshot?: (snapshot: ApplicationStoreSnapshot<T>) => void
  remote: () => Promise<T>
}

export class ApplicationStore {
  async readThrough<T>({ local, onSnapshot, remote }: ReadThroughOptions<T>) {
    let localData: T | undefined

    try {
      localData = await local()
      onSnapshot?.({ data: localData, source: 'local' })
    } catch {
      localData = undefined
    }

    try {
      const remoteData = await remote()
      onSnapshot?.({ data: remoteData, source: 'remote' })
      return remoteData
    } catch (error) {
      if (localData !== undefined) return localData
      throw error
    }
  }

  async listUsers(options?: {
    onSnapshot?: (snapshot: ApplicationStoreSnapshot<EmployeeUser[]>) => void
  }) {
    return this.readThrough({
      local: listEmployeeUsers,
      onSnapshot: options?.onSnapshot,
      remote: listEmployeeUsersBackendFirst,
    })
  }

  async getPlanningPackage({
    onSnapshot,
    periodMonth,
    viewer = defaultViewer,
  }: {
    onSnapshot?: (snapshot: ApplicationStoreSnapshot<PlanningPackage>) => void
    periodMonth: string
    viewer?: AppViewer
  }) {
    return this.readThrough({
      local: () => getLocalPlanningPackage(periodMonth, viewer),
      onSnapshot,
      remote: () => getPlanningPackageBackendFirst(periodMonth, viewer),
    })
  }

  async getReportsPackage({
    onSnapshot,
    periodMonth,
  }: {
    onSnapshot?: (snapshot: ApplicationStoreSnapshot<ReportsPackage>) => void
    periodMonth: string
  }) {
    return this.readThrough({
      local: () => getLocalReportsPackage(periodMonth),
      onSnapshot,
      remote: () => getReportsPackageBackendFirst(periodMonth),
    })
  }

  async getTimesheetApproval({
    employeeId,
    onSnapshot,
    periodMonth,
  }: {
    employeeId: string
    onSnapshot?: (
      snapshot: ApplicationStoreSnapshot<MonthlyTimesheetApproval>
    ) => void
    periodMonth: string
  }) {
    return this.readThrough({
      local: () => getTimesheetApproval(employeeId, periodMonth),
      onSnapshot,
      remote: () => getTimesheetApprovalBackendFirst(employeeId, periodMonth),
    })
  }

  async hydrateProjections(
    modules: readonly ProjectionHydrationModule[] = projectionHydrationModules
  ) {
    return applicationStoreHydration.hydrate(modules)
  }
}

async function getLocalReportsPackage(periodMonth: string) {
  const cached = await getCachedReportsPackage(periodMonth)
  if (cached) return cached

  const [users, requests, clockEvents, policy, approvals] = await Promise.all([
    listEmployeeUsers(),
    listEmployeeRequests(),
    listAllClockEvents(),
    getAttendancePolicyConfig(),
    listAllTimesheetApprovals(),
  ])

  return buildReportsPackage({
    approvals,
    clockEvents,
    periodMonth,
    policy,
    requests,
    users,
  })
}

async function getLocalPlanningPackage(periodMonth: string, viewer: AppViewer) {
  const cached = await getCachedPlanningPackage(periodMonth)
  if (cached) return cached

  return buildLocalPlanningPackage(periodMonth, viewer)
}

export const applicationStore = new ApplicationStore()

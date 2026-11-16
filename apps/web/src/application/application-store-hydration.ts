import { listAuditEventsWorkflow } from '@/data/api/audit.api'
import { listEmploymentContractsWorkflow } from '@/data/api/employment-contracts.api'
import {
  moduleAggregateApi,
  type ApiModuleAggregateItem,
  type ModuleAggregateName,
} from '@/data/api/module-aggregates.api'
import { listOrganizationCatalogWorkflow } from '@/data/api/organization.api'
import { getPlanningPackageWorkflow } from '@/data/api/planning.api'
import { getReportsPackageWorkflow } from '@/data/api/reports.api'
import { refreshSyncMeta } from '@/data/local/attendance.repo'
import { cacheAuditEvents } from '@/data/local/audit.repo'
import { cacheManagerDelegations } from '@/data/local/delegations.repo'
import { cacheEmploymentContracts } from '@/data/local/employment-contracts.repo'
import { cacheOrganizationRecord } from '@/data/local/organization.repo'
import { cachePlanningPackage } from '@/data/local/planning-packages.repo'
import { cacheReportsPackage } from '@/data/local/reports-packages.repo'
import { applyAggregatePayload } from '@/data/sync/sync-engine'
import type { OutboxOperation } from '@/domain/attendance/types'
import type { ManagerDelegation } from '@/domain/users/delegations'
import { formatPeriodMonth, getCurrentMonthDate } from '@/lib/periods'

const clientAggregateHydrationModules = [
  'requests',
  'absences',
  'notifications',
  'timesheets',
  'users',
] as const satisfies readonly ModuleAggregateName[]

type ClientAggregateHydrationModule =
  (typeof clientAggregateHydrationModules)[number]

const workflowHydrationModules = [
  'audit',
  'organizationCatalogs',
  'employmentContracts',
  'planning',
  'reports',
] as const

type WorkflowHydrationModule = (typeof workflowHydrationModules)[number]

export const projectionHydrationModules = [
  ...clientAggregateHydrationModules,
  ...workflowHydrationModules,
] as const

export type ProjectionHydrationModule =
  (typeof projectionHydrationModules)[number]

export type ProjectionHydrationModuleResult = {
  itemCount: number
  lastError?: string
  lastHydratedAt?: string
}

export type ProjectionHydrationResult = {
  modules: Record<ProjectionHydrationModule, ProjectionHydrationModuleResult>
  ok: boolean
}

type ProjectionHydrationDependencies = {
  applyItem: (item: ApiModuleAggregateItem) => Promise<void>
  listAll: (
    module: ClientAggregateHydrationModule
  ) => Promise<ApiModuleAggregateItem[]>
  hydrateWorkflowModule: (module: WorkflowHydrationModule) => Promise<number>
  markSynced: (
    result: ProjectionHydrationResult
  ) => Promise<ProjectionHydrationResult>
}

const defaultDependencies: ProjectionHydrationDependencies = {
  applyItem: applyProjectionItem,
  listAll: (module) =>
    moduleAggregateApi[module].listAll({
      includeDeleted: true,
      limit: 100,
    }),
  hydrateWorkflowModule,
  async markSynced(result) {
    await refreshSyncMeta({
      isOnline: result.ok,
      lastError: result.ok
        ? undefined
        : Object.values(result.modules).find((module) => module.lastError)
            ?.lastError,
      projectionHydration: result.modules,
    })

    return result
  },
}

export function createApplicationStoreHydration(
  dependencies: ProjectionHydrationDependencies = defaultDependencies
) {
  return {
    async hydrate(
      modules: readonly ProjectionHydrationModule[] = projectionHydrationModules
    ) {
      const result: ProjectionHydrationResult = {
        modules: emptyModuleResults(),
        ok: true,
      }

      for (const module of modules) {
        const hydratedAt = new Date().toISOString()

        try {
          if (isClientAggregateHydrationModule(module)) {
            const items = await dependencies.listAll(module)

            for (const item of items) {
              await dependencies.applyItem(item)
            }

            result.modules[module] = {
              itemCount: items.length,
              lastHydratedAt: hydratedAt,
            }
            continue
          }

          const itemCount = await dependencies.hydrateWorkflowModule(module)

          result.modules[module] = {
            itemCount,
            lastHydratedAt: hydratedAt,
          }
        } catch (error) {
          result.ok = false
          result.modules[module] = {
            itemCount: 0,
            lastError:
              error instanceof Error
                ? error.message
                : `Unable to hydrate ${module}.`,
            lastHydratedAt: hydratedAt,
          }
        }
      }

      return dependencies.markSynced(result)
    },
  }
}

async function applyProjectionItem(item: ApiModuleAggregateItem) {
  if (!isSupportedAggregate(item.aggregate)) {
    return
  }

  await applyAggregatePayload({
    aggregate: item.aggregate,
    aggregateId: item.aggregateId,
    deleted: item.isDeleted,
    payload: item.payload,
  })
}

async function hydrateWorkflowModule(module: WorkflowHydrationModule) {
  if (module === 'audit') {
    const events = await listAuditEventsWorkflow()
    await cacheAuditEvents(events)

    return events.length
  }

  if (module === 'organizationCatalogs') {
    const catalog = await listOrganizationCatalogWorkflow()
    await Promise.all(catalog.records.map(cacheOrganizationRecord))

    const delegationsByManager = groupDelegationsByManager(catalog.delegations)
    await Promise.all(
      Array.from(delegationsByManager).map(([managerId, delegations]) =>
        cacheManagerDelegations(managerId, delegations)
      )
    )

    return catalog.records.length + catalog.delegations.length
  }

  if (module === 'reports') {
    const report = await getReportsPackageWorkflow(
      formatPeriodMonth(getCurrentMonthDate())
    )
    await cacheReportsPackage(report)

    return report.employeeReports.length
  }

  if (module === 'planning') {
    const planningPackage = await getPlanningPackageWorkflow(
      formatPeriodMonth(getCurrentMonthDate())
    )
    await cachePlanningPackage(planningPackage)

    return planningPackage.people.length
  }

  const contracts = await listEmploymentContractsWorkflow()
  return cacheEmploymentContracts(contracts)
}

function groupDelegationsByManager(delegations: ManagerDelegation[]) {
  return delegations.reduce((groups, delegation) => {
    const managerDelegations = groups.get(delegation.managerId) ?? []
    managerDelegations.push(delegation)
    groups.set(delegation.managerId, managerDelegations)

    return groups
  }, new Map<string, ManagerDelegation[]>())
}

function emptyModuleResults() {
  return Object.fromEntries(
    projectionHydrationModules.map((module) => [
      module,
      {
        itemCount: 0,
      },
    ])
  ) as Record<ProjectionHydrationModule, ProjectionHydrationModuleResult>
}

function isClientAggregateHydrationModule(
  module: ProjectionHydrationModule
): module is ClientAggregateHydrationModule {
  return clientAggregateHydrationModules.includes(
    module as ClientAggregateHydrationModule
  )
}

function isSupportedAggregate(
  aggregate: string
): aggregate is OutboxOperation['aggregate'] {
  return [
    'absence',
    'notification',
    'payroll-export',
    'request',
    'timesheet',
    'user',
  ].includes(aggregate)
}

export const applicationStoreHydration = createApplicationStoreHydration()

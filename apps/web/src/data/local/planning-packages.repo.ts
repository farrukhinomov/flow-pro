import type { PlanningPackage } from '@/domain/planning/types'
import { getFromStore, putInStore } from './db'

type CachedPlanningPackage = {
  cachedAt: string
  id: string
  package: PlanningPackage
  periodMonth: string
}

function makePackageId(periodMonth: string) {
  return `planning-${periodMonth}`
}

export async function getCachedPlanningPackage(periodMonth: string) {
  const cached = await getFromStore<CachedPlanningPackage>(
    'planningPackages',
    makePackageId(periodMonth)
  )

  return cached?.package
}

export async function cachePlanningPackage(planningPackage: PlanningPackage) {
  await putInStore<CachedPlanningPackage>('planningPackages', {
    cachedAt: new Date().toISOString(),
    id: makePackageId(planningPackage.periodMonth),
    package: planningPackage,
    periodMonth: planningPackage.periodMonth,
  })

  return planningPackage
}

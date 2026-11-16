import type { ReportsPackage } from '@/domain/reports/payroll'
import { getFromStore, putInStore } from './db'

type CachedReportsPackage = {
  cachedAt: string
  id: string
  package: ReportsPackage
  periodMonth: string
}

function makePackageId(periodMonth: string) {
  return `reports-${periodMonth}`
}

export async function getCachedReportsPackage(periodMonth: string) {
  const cached = await getFromStore<CachedReportsPackage>(
    'reportsPackages',
    makePackageId(periodMonth)
  )

  return cached?.package
}

export async function cacheReportsPackage(reportsPackage: ReportsPackage) {
  await putInStore<CachedReportsPackage>('reportsPackages', {
    cachedAt: new Date().toISOString(),
    id: makePackageId(reportsPackage.periodMonth),
    package: reportsPackage,
    periodMonth: reportsPackage.periodMonth,
  })

  return reportsPackage
}

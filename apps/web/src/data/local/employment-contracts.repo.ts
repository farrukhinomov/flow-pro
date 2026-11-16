import type { EmploymentContractRecord } from '@/domain/organization/types'
import { getAllFromStore, putManyInStore } from './db'

type CacheableEmploymentContract = EmploymentContractRecord & { id: string }

function toDate(value: unknown, fallback = new Date()) {
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const nextDate = new Date(value)
    if (!Number.isNaN(nextDate.getTime())) return nextDate
  }
  return fallback
}

function isCacheableContract(
  contract: EmploymentContractRecord
): contract is CacheableEmploymentContract {
  return typeof contract.id === 'string' && contract.id.length > 0
}

function normalizeContract(
  contract: CacheableEmploymentContract
): CacheableEmploymentContract {
  const createdAt = toDate(contract.createdAt)

  return {
    ...contract,
    createdAt,
    updatedAt: toDate(contract.updatedAt, createdAt),
  }
}

export async function listLocalEmploymentContracts(employeeId?: string) {
  const contracts = await getAllFromStore<CacheableEmploymentContract>(
    'employmentContracts'
  )
  const normalized = contracts.map(normalizeContract)

  return employeeId
    ? normalized.filter((contract) => contract.employeeId === employeeId)
    : normalized
}

export async function cacheEmploymentContracts(
  contracts: EmploymentContractRecord[]
) {
  const cacheableContracts = contracts
    .filter(isCacheableContract)
    .map(normalizeContract)

  await putManyInStore('employmentContracts', cacheableContracts)
  return cacheableContracts.length
}

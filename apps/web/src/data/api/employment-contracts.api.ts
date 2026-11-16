import type { EmploymentContractRecord } from '@/domain/organization/types'
import { flowProApi } from './http-client'

export type { EmploymentContractRecord }

type ApiEmploymentContractRecord = Omit<
  EmploymentContractRecord,
  'createdAt' | 'updatedAt'
> & {
  createdAt: string
  updatedAt: string
}

type ApiEmploymentContractPage = {
  items: ApiEmploymentContractRecord[]
}

export async function listEmploymentContractsWorkflow(employeeId?: string) {
  const response = await flowProApi.get<ApiEmploymentContractPage>(
    '/directory/employment-contracts',
    {
      params: employeeId ? { employeeId } : undefined,
    }
  )

  return response.data.items.map(mapContractFromApi)
}

export async function saveEmploymentContractWorkflow(
  contract: EmploymentContractRecord
) {
  const payload = mapContractToApi(contract)
  const response = contract.id
    ? await flowProApi.put<ApiEmploymentContractRecord>(
        `/directory/employment-contracts/${encodeURIComponent(contract.id)}`,
        payload
      )
    : await flowProApi.post<ApiEmploymentContractRecord>(
        '/directory/employment-contracts',
        payload
      )

  return mapContractFromApi(response.data)
}

function mapContractToApi(
  contract: EmploymentContractRecord
): ApiEmploymentContractRecord {
  return {
    ...contract,
    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString(),
  }
}

function mapContractFromApi(
  contract: ApiEmploymentContractRecord
): EmploymentContractRecord {
  return {
    ...contract,
    createdAt: new Date(contract.createdAt),
    updatedAt: new Date(contract.updatedAt),
  }
}

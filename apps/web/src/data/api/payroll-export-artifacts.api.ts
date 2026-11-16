import { flowProApi } from './http-client'

export type PayrollExportArtifactKind =
  'payroll' | 'balances' | 'teams' | 'excel' | 'pdf'

export type PayrollExportArtifact = {
  id: string
  periodMonth: string
  kind: PayrollExportArtifactKind
  employeeId?: string | null
  fileName: string
  contentType: string
  sizeBytes: number
  sha256: string
  objectKey: string
  storageProvider: string
  requestedByUserId: string
  generatedAt: string
  status: 'ready' | 'processing' | 'failed'
  serverVersion: string
}

export async function createPayrollExportArtifact(input: {
  employeeId?: string
  kind: PayrollExportArtifactKind
  locale?: string
  periodMonth: string
}) {
  const response = await flowProApi.post<PayrollExportArtifact>(
    '/payroll-export-artifacts',
    input
  )

  return response.data
}

export async function listPayrollExportArtifacts(periodMonth?: string) {
  const response = await flowProApi.get<{ items: PayrollExportArtifact[] }>(
    '/payroll-export-artifacts',
    {
      params: {
        periodMonth,
      },
    }
  )

  return response.data.items
}

export async function downloadPayrollExportArtifact(artifactId: string) {
  const response = await flowProApi.get<Blob>(
    `/payroll-export-artifacts/${encodeURIComponent(artifactId)}/download`,
    {
      responseType: 'blob',
    }
  )

  return response.data
}

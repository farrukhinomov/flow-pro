import type {
  ApiDateTime,
  ApiSyncBatchResponseDto,
  ApiSyncOperationDto,
} from '@/contracts/api'
import { flowProApi } from './http-client'

export type ModuleAggregateName =
  | 'absences'
  | 'approvalWorkflows'
  | 'approvals'
  | 'attachments'
  | 'managerTimesheets'
  | 'notifications'
  | 'payrollExports'
  | 'requests'
  | 'timesheets'
  | 'users'

export type ApiModuleAggregateItem = {
  aggregate: ApiSyncOperationDto['aggregate']
  aggregateId: string
  payload: unknown
  isDeleted: boolean
  serverVersion: string
  updatedAt: ApiDateTime
  ownerUserId?: string | null
}

export type ApiModuleAggregatePage = {
  items: ApiModuleAggregateItem[]
  nextCursor?: string | null
}

export type ApiModuleAggregateMutation = {
  clientId?: string
  clientOperationId?: string
  payload: unknown
  clientCreatedAt?: ApiDateTime
  conflict?: {
    resolution?: 'local-wins' | 'remote-wins' | 'manual'
  }
}

export type ApiModuleAggregateDelete = Omit<
  ApiModuleAggregateMutation,
  'payload'
>

export type ApiUploadedAttachment = {
  id: string
  objectKey: string
  fileName: string
  contentType: string
  sizeBytes: number
  sha256: string
  uploadedAt: ApiDateTime
  ownerUserId: string
  serverVersion: string
}

export type ApiDeletedAttachment = {
  id: string
  deletedAt: ApiDateTime
  purgeEligibleAt: ApiDateTime
  serverVersion: string
}

const modulePaths: Record<ModuleAggregateName, string> = {
  absences: '/absences',
  approvalWorkflows: '/approval-workflows',
  approvals: '/approvals',
  attachments: '/attachments',
  managerTimesheets: '/manager-timesheets',
  notifications: '/notifications',
  payrollExports: '/payroll/exports',
  requests: '/requests',
  timesheets: '/timesheets',
  users: '/users',
}

export function createModuleAggregateApi(module: ModuleAggregateName) {
  const path = modulePaths[module]

  return {
    delete: (aggregateId: string, request?: ApiModuleAggregateDelete) =>
      deleteModuleAggregate(path, aggregateId, request),
    list: (params?: ModuleAggregateListParams) =>
      listModuleAggregates(path, params),
    listAll: (params?: ListAllModuleAggregatesOptions) =>
      listAllModuleAggregates(path, params),
    upsert: (aggregateId: string, request: ApiModuleAggregateMutation) =>
      upsertModuleAggregate(path, aggregateId, request),
  }
}

export type ModuleAggregateListParams = {
  cursor?: string
  includeDeleted?: boolean
  limit?: number
}

export type ListAllModuleAggregatesOptions = ModuleAggregateListParams & {
  maxPages?: number
}

export const moduleAggregateApi = {
  absences: createModuleAggregateApi('absences'),
  approvalWorkflows: createModuleAggregateApi('approvalWorkflows'),
  approvals: createModuleAggregateApi('approvals'),
  attachments: createModuleAggregateApi('attachments'),
  managerTimesheets: createModuleAggregateApi('managerTimesheets'),
  notifications: createModuleAggregateApi('notifications'),
  payrollExports: createModuleAggregateApi('payrollExports'),
  requests: createModuleAggregateApi('requests'),
  timesheets: createModuleAggregateApi('timesheets'),
  users: createModuleAggregateApi('users'),
}

export async function uploadAttachmentFile({
  clientId,
  clientOperationId,
  file,
}: {
  clientId?: string
  clientOperationId?: string
  file: File
}) {
  const form = new FormData()
  form.append('file', file)

  if (clientId) {
    form.append('clientId', clientId)
  }

  if (clientOperationId) {
    form.append('clientOperationId', clientOperationId)
  }

  const response = await flowProApi.post<ApiUploadedAttachment>(
    '/attachments/files',
    form
  )

  return response.data
}

export async function downloadAttachmentFile(attachmentId: string) {
  const response = await flowProApi.get<Blob>(
    `/attachments/files/${encodeURIComponent(attachmentId)}`,
    {
      responseType: 'blob',
    }
  )

  return response.data
}

export async function deleteAttachmentFile({
  attachmentId,
  clientId,
  clientOperationId,
}: {
  attachmentId: string
  clientId?: string
  clientOperationId?: string
}) {
  const response = await flowProApi.delete<ApiDeletedAttachment>(
    `/attachments/files/${encodeURIComponent(attachmentId)}`,
    {
      params: {
        clientId,
        clientOperationId,
      },
    }
  )

  return response.data
}

async function listModuleAggregates(
  path: string,
  params?: ModuleAggregateListParams
) {
  const response = await flowProApi.get<ApiModuleAggregatePage>(path, {
    params: compactParams(params),
  })

  return response.data
}

async function listAllModuleAggregates(
  path: string,
  { maxPages = 20, ...params }: ListAllModuleAggregatesOptions = {}
): Promise<ApiModuleAggregateItem[]> {
  const items: ApiModuleAggregateItem[] = []
  let cursor = params.cursor

  for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
    const page = await listModuleAggregates(path, {
      ...params,
      cursor,
    })
    items.push(...page.items)

    if (!page.nextCursor) {
      return items
    }

    cursor = page.nextCursor
  }

  throw new Error(
    `Module aggregate feed exceeded ${maxPages} pages without reaching the end.`
  )
}

async function upsertModuleAggregate(
  path: string,
  aggregateId: string,
  request: ApiModuleAggregateMutation
) {
  const response = await flowProApi.put<ApiSyncBatchResponseDto>(
    `${path}/${encodeURIComponent(aggregateId)}`,
    request
  )

  return response.data
}

function compactParams(params: ModuleAggregateListParams = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  )
}

async function deleteModuleAggregate(
  path: string,
  aggregateId: string,
  request?: ApiModuleAggregateDelete
) {
  const response = await flowProApi.delete<ApiSyncBatchResponseDto>(
    `${path}/${encodeURIComponent(aggregateId)}`,
    {
      params: {
        clientCreatedAt: request?.clientCreatedAt,
        clientId: request?.clientId,
        clientOperationId: request?.clientOperationId,
        conflictResolution: request?.conflict?.resolution,
      },
    }
  )

  return response.data
}

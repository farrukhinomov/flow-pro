import type { ApiSyncPageDto } from '@/contracts/api'
import type {
  SyncBatchRequest,
  SyncBatchResponse,
} from '@/domain/sync/protocol'
import { flowProApi } from './http-client'

export async function submitSyncBatch(request: SyncBatchRequest) {
  const response = await flowProApi.post<SyncBatchResponse>(
    '/sync/batches',
    request
  )

  return response.data
}

export async function listSyncChanges({
  after,
  limit = 100,
}: {
  after: number
  limit?: number
}) {
  const response = await flowProApi.get<ApiSyncPageDto>('/sync/changes', {
    params: { after, limit },
  })

  return response.data
}

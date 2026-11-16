import { parseApiAuthSessionDto } from '@/contracts/api'
import { flowProApi } from './http-client'

export async function getCurrentAuthSession() {
  const response = await flowProApi.get<unknown>('/auth/session')

  return parseApiAuthSessionDto(response.data)
}

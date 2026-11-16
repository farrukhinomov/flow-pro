import { isSessionAuthEnabled } from '@/data/auth/auth-mode'
import type { EmployeeUser, UserRole } from '@/domain/users/types'
import { FlowProApiError, flowProApi } from './http-client'

type ApiUserStatus = 'active' | 'invited' | 'inactive' | 'suspended'

type ApiUserWorkflowRecord = Omit<
  EmployeeUser,
  | 'createdAt'
  | 'updatedAt'
  | 'lastSeenAt'
  | 'nextReviewAt'
  | 'deactivatedAt'
  | 'retentionUntil'
> & {
  createdAt: string
  updatedAt: string
  lastSeenAt?: string | null
  nextReviewAt?: string | null
  deactivatedAt?: string | null
  retentionUntil?: string | null
  role: UserRole
  status: ApiUserStatus
  /** The membership id, which requests, sessions and sync use. */
  userId?: string | null
}

type ApiUserWorkflowResult = {
  user: ApiUserWorkflowRecord
}

type ApiUserDirectoryPage = {
  items: ApiUserWorkflowRecord[]
  nextCursor?: string | null
}

export type ListUsersWorkflowInput = {
  cursor?: string
  limit?: number
  role?: UserRole
  search?: string
  status?: ApiUserStatus
  team?: string
}

export type UserDirectoryPage = {
  items: EmployeeUser[]
  nextCursor?: string
}

export async function listUsersPageWorkflow(
  input: ListUsersWorkflowInput = {}
): Promise<UserDirectoryPage> {
  const response = await flowProApi.get<ApiUserDirectoryPage>(
    '/directory/users',
    { params: compactParams(input) }
  )

  return {
    items: response.data.items.map(mapUserFromApi),
    nextCursor: response.data.nextCursor ?? undefined,
  }
}

export async function listUsersWorkflow(input: ListUsersWorkflowInput = {}) {
  const page = await listUsersPageWorkflow(input)

  return page.items
}

export async function saveUserWorkflow(user: EmployeeUser) {
  const response = await flowProApi.put<ApiUserWorkflowResult>(
    `/directory/users/${encodeURIComponent(user.id)}`,
    mapUserToApi(user)
  )

  return mapUserFromApi(response.data.user)
}

export async function inviteUserWorkflow(input: {
  email: string
  note?: string
  role: UserRole
}) {
  const response = await flowProApi.post<ApiUserWorkflowResult>(
    '/directory/users/invitations',
    input
  )

  return mapUserFromApi(response.data.user)
}

/** Sends a new invitation link; the previous one stops working. */
export async function resendInvitation(userId: string) {
  await flowProApi.post(
    `/directory/users/${encodeURIComponent(userId)}/invitation`
  )
}

export async function deactivateUserWorkflow({
  reason,
  user,
}: {
  reason?: string
  user: EmployeeUser
}) {
  const response = await flowProApi.post<ApiUserWorkflowResult>(
    `/directory/users/${encodeURIComponent(user.id)}/deactivate`,
    { reason }
  )

  return mapUserFromApi(response.data.user)
}

export async function reactivateUserWorkflow(user: EmployeeUser) {
  const response = await flowProApi.post<ApiUserWorkflowResult>(
    `/directory/users/${encodeURIComponent(user.id)}/reactivate`
  )

  return mapUserFromApi(response.data.user)
}

export function shouldFallbackToLocalUsers(error: unknown) {
  return (
    !(error instanceof FlowProApiError) ||
    error.status === undefined ||
    error.status >= 500
  )
}

function mapUserToApi(user: EmployeeUser): ApiUserWorkflowRecord {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    deactivatedAt: user.deactivatedAt?.toISOString() ?? null,
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    nextReviewAt: user.nextReviewAt?.toISOString() ?? null,
    retentionUntil: user.retentionUntil?.toISOString() ?? null,
    updatedAt: user.updatedAt.toISOString(),
  }
}

function mapUserFromApi({
  userId,
  ...user
}: ApiUserWorkflowRecord): EmployeeUser {
  return {
    ...user,
    // Signed in for real, a person is their membership id everywhere else: on their requests,
    // in the session and in the sync feed. Development sign-in keeps the readable client id,
    // which the HTTP client translates.
    id: isSessionAuthEnabled() && userId ? userId : user.id,
    createdAt: new Date(user.createdAt),
    deactivatedAt: user.deactivatedAt
      ? new Date(user.deactivatedAt)
      : undefined,
    lastSeenAt: user.lastSeenAt ? new Date(user.lastSeenAt) : undefined,
    nextReviewAt: user.nextReviewAt ? new Date(user.nextReviewAt) : undefined,
    retentionUntil: user.retentionUntil
      ? new Date(user.retentionUntil)
      : undefined,
    updatedAt: new Date(user.updatedAt),
  }
}

function compactParams(input: ListUsersWorkflowInput) {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  )
}

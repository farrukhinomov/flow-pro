import type { AttendancePolicyConfig } from '@/domain/attendance/types'
import { FlowProApiError, flowProApi } from './http-client'

export async function getAttendancePolicyConfigWorkflow(
  policyId: AttendancePolicyConfig['id'] = 'default'
) {
  const response = await flowProApi.get<AttendancePolicyConfig>(
    `/attendance-policy-workflows/${encodeURIComponent(policyId)}`
  )

  if (response.status === 204 || !response.data) {
    throw new FlowProApiError(
      'Attendance policy configuration has not been published yet.',
      'attendance_policy.not_found',
      204
    )
  }

  return response.data
}

export async function publishAttendancePolicyConfigWorkflow(
  config: AttendancePolicyConfig
) {
  const response = await flowProApi.put<AttendancePolicyConfig>(
    `/attendance-policy-workflows/${encodeURIComponent(config.id)}`,
    config
  )

  return response.data
}

export function shouldFallbackToLocalAttendancePolicy(error: unknown) {
  return (
    !(error instanceof FlowProApiError) ||
    error.status === undefined ||
    error.status === 204 ||
    error.status === 404 ||
    error.status >= 500
  )
}

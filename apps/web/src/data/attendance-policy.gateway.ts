import type { AttendancePolicyConfig } from '@/domain/attendance/types'
import {
  getAttendancePolicyConfigWorkflow,
  shouldFallbackToLocalAttendancePolicy,
} from './api/attendance-policy.api'
import {
  cacheAttendancePolicyConfig,
  getAttendancePolicyConfig,
} from './local/attendance.repo'

export async function getAttendancePolicyConfigBackendFirst(): Promise<AttendancePolicyConfig> {
  try {
    const config = await getAttendancePolicyConfigWorkflow()
    await cacheAttendancePolicyConfig(config)
    return config
  } catch (error) {
    if (!shouldFallbackToLocalAttendancePolicy(error)) throw error
  }

  return getAttendancePolicyConfig()
}

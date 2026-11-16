import {
  publishAttendancePolicyConfigWorkflow,
  shouldFallbackToLocalAttendancePolicy,
} from '@/data/api/attendance-policy.api'
import {
  cacheAttendancePolicyConfig,
  removeAttendanceType,
  upsertAttendancePolicyConfig,
  upsertAttendanceType,
} from '@/data/local/attendance.repo'
import {
  notifyLocalDataChanged,
  syncAttendanceOutbox,
} from '@/data/sync/sync-engine'
import type {
  AttendancePolicyConfig,
  AttendanceStatusType,
} from '@/domain/attendance/types'
import { runLocalWriteEffects, type LocalWriteEffects } from './sync-effects'

export type AttendancePolicyWorkflowDependencies = LocalWriteEffects & {
  cacheAttendancePolicyConfig: typeof cacheAttendancePolicyConfig
  publishAttendancePolicyConfigWorkflow: typeof publishAttendancePolicyConfigWorkflow
  removeAttendanceType: typeof removeAttendanceType
  shouldFallbackToLocalAttendancePolicy: typeof shouldFallbackToLocalAttendancePolicy
  upsertAttendancePolicyConfig: typeof upsertAttendancePolicyConfig
  upsertAttendanceType: typeof upsertAttendanceType
}

const defaultDependencies: AttendancePolicyWorkflowDependencies = {
  cacheAttendancePolicyConfig,
  notifyLocalDataChanged,
  publishAttendancePolicyConfigWorkflow,
  removeAttendanceType,
  shouldFallbackToLocalAttendancePolicy,
  syncAttendanceOutbox,
  upsertAttendancePolicyConfig,
  upsertAttendanceType,
}

export function createAttendancePolicyWorkflowService(
  dependencies: AttendancePolicyWorkflowDependencies = defaultDependencies
) {
  return {
    async saveType(type: AttendanceStatusType) {
      await dependencies.upsertAttendanceType(type)
      await runLocalWriteEffects(dependencies)
    },

    async deleteType(id: string) {
      await dependencies.removeAttendanceType(id)
      await runLocalWriteEffects(dependencies)
    },

    async saveConfig(config: AttendancePolicyConfig) {
      try {
        const nextConfig =
          await dependencies.publishAttendancePolicyConfigWorkflow(config)
        await dependencies.cacheAttendancePolicyConfig(nextConfig)
        await dependencies.notifyLocalDataChanged()
        return nextConfig
      } catch (error) {
        if (!dependencies.shouldFallbackToLocalAttendancePolicy(error)) {
          throw error
        }
      }

      const nextConfig = await dependencies.upsertAttendancePolicyConfig(config)

      await runLocalWriteEffects(dependencies)

      return nextConfig
    },
  }
}

export const attendancePolicyWorkflow = createAttendancePolicyWorkflowService()

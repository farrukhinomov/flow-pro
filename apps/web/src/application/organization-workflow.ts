import {
  saveOrganizationRecordWorkflow,
  setManagerDelegationsWorkflow,
  shouldFallbackToLocalOrganization,
} from '@/data/api/organization.api'
import {
  cacheManagerDelegations,
  setManagerDelegations,
} from '@/data/local/delegations.repo'
import {
  cacheOrganizationRecord,
  saveOrganizationRecord,
} from '@/data/local/organization.repo'
import {
  notifyLocalDataChanged,
  syncAttendanceOutbox,
} from '@/data/sync/sync-engine'
import type { OrganizationCatalogRecord } from '@/domain/organization/types'
import { runLocalWriteEffects, type LocalWriteEffects } from './sync-effects'

type OrganizationWorkflowDependencies = LocalWriteEffects & {
  cacheManagerDelegations: typeof cacheManagerDelegations
  cacheOrganizationRecord: typeof cacheOrganizationRecord
  saveOrganizationRecordWorkflow: typeof saveOrganizationRecordWorkflow
  saveOrganizationRecord: typeof saveOrganizationRecord
  setManagerDelegations: typeof setManagerDelegations
  setManagerDelegationsWorkflow: typeof setManagerDelegationsWorkflow
  shouldFallbackToLocalOrganization: typeof shouldFallbackToLocalOrganization
}

const defaultDependencies: OrganizationWorkflowDependencies = {
  cacheManagerDelegations,
  cacheOrganizationRecord,
  notifyLocalDataChanged,
  saveOrganizationRecordWorkflow,
  saveOrganizationRecord,
  setManagerDelegations,
  setManagerDelegationsWorkflow,
  shouldFallbackToLocalOrganization,
  syncAttendanceOutbox,
}

export function createOrganizationWorkflowService(
  dependencies: OrganizationWorkflowDependencies = defaultDependencies
) {
  return {
    async saveRecord(record: OrganizationCatalogRecord) {
      try {
        const savedRecord =
          await dependencies.saveOrganizationRecordWorkflow(record)
        await dependencies.cacheOrganizationRecord(savedRecord)
        await dependencies.notifyLocalDataChanged()
        return savedRecord
      } catch (error) {
        if (!dependencies.shouldFallbackToLocalOrganization(error)) throw error
      }

      await dependencies.saveOrganizationRecord(record)
      await runLocalWriteEffects(dependencies)
      return record
    },

    async setManagerDelegations(input: { managerId: string; teams: string[] }) {
      try {
        const delegations =
          await dependencies.setManagerDelegationsWorkflow(input)
        await dependencies.cacheManagerDelegations(input.managerId, delegations)
        await dependencies.notifyLocalDataChanged()
        return delegations
      } catch (error) {
        if (!dependencies.shouldFallbackToLocalOrganization(error)) throw error
      }

      await dependencies.setManagerDelegations(input)
      await runLocalWriteEffects(dependencies)
      return []
    },
  }
}

export const organizationWorkflow = createOrganizationWorkflowService()

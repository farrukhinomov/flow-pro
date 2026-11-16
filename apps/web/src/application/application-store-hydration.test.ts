import type { ApiModuleAggregateItem } from '@/data/api/module-aggregates.api'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createApplicationStoreHydration,
  type ProjectionHydrationResult,
} from './application-store-hydration'

describe('application store projection hydration', () => {
  it('hydrates selected modules and applies every projection item', async () => {
    const applied: ApiModuleAggregateItem[] = []
    let marked: ProjectionHydrationResult | undefined
    const hydration = createApplicationStoreHydration({
      applyItem: async (item) => {
        applied.push(item)
      },
      listAll: async (module) =>
        module === 'requests'
          ? [
              createProjectionItem('request', 'request-1'),
              createProjectionItem('request', 'request-2'),
            ]
          : [createProjectionItem('notification', 'notification-1')],
      hydrateWorkflowModule: async () => 0,
      markSynced: async (result) => {
        marked = result
        return result
      },
    })

    const result = await hydration.hydrate(['requests', 'notifications'])

    assert.equal(result.ok, true)
    assert.deepEqual(
      applied.map((item) => item.aggregateId),
      ['request-1', 'request-2', 'notification-1']
    )
    assert.equal(marked?.modules.requests.itemCount, 2)
    assert.equal(marked?.modules.notifications.itemCount, 1)
  })

  it('continues hydrating later modules when one module fails', async () => {
    const applied: ApiModuleAggregateItem[] = []
    const hydration = createApplicationStoreHydration({
      applyItem: async (item) => {
        applied.push(item)
      },
      listAll: async (module) => {
        if (module === 'requests') {
          throw new Error('Requests feed is unavailable.')
        }

        return [createProjectionItem('notification', 'notification-1')]
      },
      hydrateWorkflowModule: async () => 0,
      markSynced: async (result) => result,
    })

    const result = await hydration.hydrate(['requests', 'notifications'])

    assert.equal(result.ok, false)
    assert.match(
      result.modules.requests.lastError ?? '',
      /Requests feed is unavailable/
    )
    assert.equal(result.modules.notifications.itemCount, 1)
    assert.deepEqual(
      applied.map((item) => item.aggregateId),
      ['notification-1']
    )
  })

  it('hydrates workflow-backed modules through their dedicated contracts', async () => {
    const applied: ApiModuleAggregateItem[] = []
    const workflowModules: string[] = []
    const hydration = createApplicationStoreHydration({
      applyItem: async (item) => {
        applied.push(item)
      },
      listAll: async () => {
        throw new Error('Aggregate feed should not be used.')
      },
      hydrateWorkflowModule: async (module) => {
        workflowModules.push(module)
        if (module === 'audit') return 9
        if (module === 'organizationCatalogs') return 6
        if (module === 'planning') return 8
        if (module === 'reports') return 12
        return 3
      },
      markSynced: async (result) => result,
    })

    const result = await hydration.hydrate([
      'audit',
      'organizationCatalogs',
      'employmentContracts',
      'planning',
      'reports',
    ])

    assert.equal(result.ok, true)
    assert.deepEqual(workflowModules, [
      'audit',
      'organizationCatalogs',
      'employmentContracts',
      'planning',
      'reports',
    ])
    assert.deepEqual(applied, [])
    assert.equal(result.modules.audit.itemCount, 9)
    assert.equal(result.modules.organizationCatalogs.itemCount, 6)
    assert.equal(result.modules.employmentContracts.itemCount, 3)
    assert.equal(result.modules.planning.itemCount, 8)
    assert.equal(result.modules.reports.itemCount, 12)
  })
})

function createProjectionItem(
  aggregate: ApiModuleAggregateItem['aggregate'],
  aggregateId: string
): ApiModuleAggregateItem {
  return {
    aggregate,
    aggregateId,
    isDeleted: false,
    ownerUserId: null,
    payload: {
      id: aggregateId,
    },
    serverVersion: 'v1',
    updatedAt: '2026-06-14T08:00:00.000Z',
  }
}

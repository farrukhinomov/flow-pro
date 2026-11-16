import type { AxiosRequestConfig } from 'axios'
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { flowProApi } from './http-client'
import { moduleAggregateApi } from './module-aggregates.api'

type CapturedRequest = {
  path: string
  params?: Record<string, unknown>
}

const originalGet = flowProApi.get.bind(flowProApi)

afterEach(() => {
  flowProApi.get = originalGet
})

describe('module aggregate api pagination', () => {
  it('lists all aggregate pages with the previous next cursor', async () => {
    const requests: CapturedRequest[] = []

    flowProApi.get = (async (path: string, config?: AxiosRequestConfig) => {
      requests.push({
        path: String(path),
        params: config?.params as Record<string, unknown> | undefined,
      })

      return {
        data:
          requests.length === 1
            ? {
                items: [
                  createAggregateItem('request', 'request-1'),
                  createAggregateItem('request', 'request-2'),
                ],
                nextCursor: 'cursor-2',
              }
            : {
                items: [createAggregateItem('request', 'request-3')],
                nextCursor: null,
              },
      }
    }) as typeof flowProApi.get

    const items = await moduleAggregateApi.requests.listAll({
      includeDeleted: true,
      limit: 2,
    })

    assert.deepEqual(
      items.map((item) => item.aggregateId),
      ['request-1', 'request-2', 'request-3']
    )
    assert.deepEqual(requests, [
      {
        path: '/requests',
        params: {
          includeDeleted: true,
          limit: 2,
        },
      },
      {
        path: '/requests',
        params: {
          cursor: 'cursor-2',
          includeDeleted: true,
          limit: 2,
        },
      },
    ])
  })

  it('fails when the feed exceeds the configured page cap', async () => {
    flowProApi.get = (async () => ({
      data: {
        items: [createAggregateItem('notification', 'notification-loop')],
        nextCursor: 'same-cursor',
      },
    })) as typeof flowProApi.get

    await assert.rejects(
      () => moduleAggregateApi.notifications.listAll({ maxPages: 2 }),
      /exceeded 2 pages/
    )
  })
})

function createAggregateItem(aggregate: string, aggregateId: string) {
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

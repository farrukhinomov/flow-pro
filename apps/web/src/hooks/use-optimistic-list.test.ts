import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { runWithRollback } from './use-optimistic-list'

/** Stands in for the hook's ref plus setState pair. */
function createRunner<TItem>(initial: TItem[]) {
  let current = initial

  return {
    get current() {
      return current
    },
    run: <TResult>(
      project: (rows: TItem[]) => TItem[],
      commit: () => Promise<TResult>
    ) =>
      runWithRollback({
        commit,
        project,
        read: () => current,
        write: (next) => {
          current = next
        },
      }),
  }
}

describe('optimistic list', () => {
  it('shows the projected list before the write resolves', async () => {
    const runner = createRunner([1, 2, 3])
    let seenDuringCommit: number[] = []

    await runner.run(
      (rows) => rows.filter((row) => row !== 2),
      async () => {
        seenDuringCommit = runner.current
      }
    )

    assert.deepEqual(seenDuringCommit, [1, 3])
    assert.deepEqual(runner.current, [1, 3])
  })

  it('restores the previous list when the write fails', async () => {
    const runner = createRunner([1, 2, 3])

    await assert.rejects(
      runner.run(
        (rows) => rows.filter((row) => row !== 2),
        () => Promise.reject(new Error('server said no'))
      ),
      /server said no/
    )

    assert.deepEqual(runner.current, [1, 2, 3])
  })

  it('rethrows so the caller still reports the failure', async () => {
    const runner = createRunner<number>([])

    await assert.rejects(
      runner.run(
        (rows) => rows,
        () => Promise.reject(new Error('boom'))
      ),
      /boom/
    )
  })

  it('restores the snapshot rather than inverting the change', async () => {
    // Inverting would leave a partially-applied edit behind when the projection
    // touches more than one field.
    const runner = createRunner([{ id: 'a', status: 'submitted' }])

    await assert.rejects(
      runner.run(
        (rows) => rows.map((row) => ({ ...row, status: 'approved' })),
        () => Promise.reject(new Error('nope'))
      )
    )

    assert.deepEqual(runner.current, [{ id: 'a', status: 'submitted' }])
  })

  it('returns the commit result on success', async () => {
    const runner = createRunner([1])
    const result = await runner.run(
      (rows) => rows,
      () => Promise.resolve('saved')
    )

    assert.equal(result, 'saved')
  })
})

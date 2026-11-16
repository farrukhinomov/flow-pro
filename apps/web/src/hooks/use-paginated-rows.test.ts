import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { derivePageState } from './use-paginated-rows'

const derive = (total: number, requestedPage: number, pageSize: number) =>
  derivePageState({ pageSize, requestedPage, total })

describe('paginated rows', () => {
  it('reports a single page for an empty list rather than zero', () => {
    const state = derive(0, 1, 25)

    assert.equal(state.pageCount, 1)
    assert.equal(state.page, 1)
    assert.equal(state.rangeStart, 0)
    assert.equal(state.rangeEnd, 0)
  })

  it('computes page count for a partial final page', () => {
    assert.equal(derive(51, 1, 25).pageCount, 3)
    assert.equal(derive(50, 1, 25).pageCount, 2)
  })

  it('describes the visible range', () => {
    const state = derive(51, 2, 25)

    assert.equal(state.rangeStart, 26)
    assert.equal(state.rangeEnd, 50)
    assert.equal(state.sliceStart, 25)
  })

  it('clamps the final page to the real row count', () => {
    const state = derive(51, 3, 25)

    assert.equal(state.rangeStart, 51)
    assert.equal(state.rangeEnd, 51)
  })

  it('clamps a page beyond the end instead of showing a blank table', () => {
    // Filtering while on a late page is the common way to hit this.
    const state = derive(10, 9, 25)

    assert.equal(state.page, 1)
    assert.equal(state.rangeEnd, 10)
  })

  it('clamps a page below one', () => {
    assert.equal(derive(100, 0, 25).page, 1)
    assert.equal(derive(100, -5, 25).page, 1)
  })
})

import { useCallback, useRef, useState } from 'react'

/**
 * Shows `project(read())` immediately, awaits `commit`, and restores the
 * previous list if it throws.
 *
 * The error is rethrown so callers still report it; this owns only the visual
 * rollback. Kept pure and separate from the hook so the rollback path — the
 * part that must not leave a half-applied edit on screen — is testable without
 * a renderer.
 */
export async function runWithRollback<TItem, TResult>({
  commit,
  project,
  read,
  write,
}: {
  commit: () => Promise<TResult>
  project: (current: TItem[]) => TItem[]
  read: () => TItem[]
  write: (next: TItem[]) => void
}): Promise<TResult> {
  const snapshot = read()

  write(project(snapshot))

  try {
    return await commit()
  } catch (error) {
    // Restores the snapshot rather than inverting the change, so a projection
    // that touched several fields cannot leave any of them applied.
    write(snapshot)
    throw error
  }
}

/**
 * Applies a local change to a list immediately and rolls it back if the write
 * fails.
 *
 * Today's attendance had a hand-rolled version of this and nothing else did, so
 * submitting a request, deciding one, or cancelling one sat through a full
 * round-trip with no feedback. That is the difference between an app that feels
 * instant and one that feels like a form post.
 *
 * The rollback restores the snapshot taken before the change rather than
 * inverting it, so a failed write cannot leave a partially-applied edit behind.
 */
export function useOptimisticList<TItem>(initial: TItem[] = []) {
  const [items, setItems] = useState<TItem[]>(initial)

  // Held in a ref so `run` never needs `items` as a dependency, which would
  // recreate every caller's callback on each keystroke elsewhere on the page.
  const itemsRef = useRef(items)

  const replace = useCallback((next: TItem[]) => {
    itemsRef.current = next
    setItems(next)
  }, [])

  const apply = useCallback((project: (current: TItem[]) => TItem[]) => {
    const next = project(itemsRef.current)

    itemsRef.current = next
    setItems(next)
  }, [])

  const run = useCallback(
    <TResult>(
      project: (current: TItem[]) => TItem[],
      commit: () => Promise<TResult>
    ): Promise<TResult> =>
      runWithRollback({
        commit,
        project,
        read: () => itemsRef.current,
        write: replace,
      }),
    [replace]
  )

  return { apply, items, replace, run }
}

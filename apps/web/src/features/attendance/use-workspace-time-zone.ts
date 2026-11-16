import { useEffect, useState } from 'react'
import {
  getWorkspaceTimeZone,
  readCachedWorkspaceTimeZone,
} from '@/data/workspace-time-zone.gateway'

/**
 * The zone that anchors day assignment for attendance records.
 *
 * Starts from the cached value so the first paint already buckets days the way
 * the workspace does, rather than bucketing in the browser zone and re-bucketing
 * a moment later — which would visibly move a late-evening booking between rows.
 *
 * Returns `undefined` until a zone is known, and every consumer treats that as
 * "use the browser zone", which is the behaviour that existed before anchoring.
 */
export function useWorkspaceTimeZone(): string | undefined {
  const [timeZone, setTimeZone] = useState<string | undefined>(
    () => readCachedWorkspaceTimeZone() ?? undefined
  )

  useEffect(() => {
    let cancelled = false

    void getWorkspaceTimeZone()
      .then((resolved) => {
        if (!cancelled) setTimeZone(resolved)
      })
      .catch(() => {
        // The cached or browser zone already applies.
      })

    return () => {
      cancelled = true
    }
  }, [])

  return timeZone
}

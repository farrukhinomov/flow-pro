import type { LocationCatalog } from '@/domain/organization/types'
import { resolveBrowserTimeZone } from '@/lib/timezones'
import { listOrganizationWorkspaceBackendFirst } from './organization.gateway'

/**
 * The zone that anchors which calendar day an attendance instant belongs to.
 *
 * Taken from the workspace's headquarters location, which is what onboarding
 * writes when the company profile is saved. It is deliberately a workspace
 * value rather than a per-user one: a working-time record has to describe the
 * same day to the employee who booked it, the manager who approves it, and the
 * payroll export, wherever any of them happen to be sitting.
 *
 * `HQ` is the code onboarding assigns to the default location. A workspace that
 * has since renamed or added locations falls back to the first one, and an
 * unreachable catalog falls back to the browser zone, which is the behaviour
 * that existed before anchoring.
 */
const HEADQUARTERS_CODE = 'HQ'
const CACHE_KEY = 'flowpro.workspace-time-zone'

function selectWorkspaceTimeZone(locations: LocationCatalog[]) {
  const headquarters =
    locations.find((location) => location.code === HEADQUARTERS_CODE) ??
    locations[0]

  return headquarters?.timeZoneId?.trim() || null
}

export function readCachedWorkspaceTimeZone(): string | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage.getItem(CACHE_KEY)
  } catch {
    return null
  }
}

function cacheWorkspaceTimeZone(timeZone: string) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(CACHE_KEY, timeZone)
  } catch {
    // A blocked storage quota must not fail the surrounding read.
  }
}

/**
 * One resolution per page load, shared by every surface that buckets days.
 *
 * Mirrors the caching used for preferences and the onboarding guard: the value
 * changes at most a handful of times in a workspace's life, and several screens
 * need it.
 */
let inFlight: Promise<string> | null = null

export function resetWorkspaceTimeZoneCache() {
  inFlight = null
}

export async function getWorkspaceTimeZone(): Promise<string> {
  inFlight ??= (async () => {
    try {
      const workspace = await listOrganizationWorkspaceBackendFirst()
      const locations = workspace.records.filter(
        (record): record is LocationCatalog => record.kind === 'location'
      )
      const timeZone = selectWorkspaceTimeZone(locations)

      if (timeZone) {
        cacheWorkspaceTimeZone(timeZone)
        return timeZone
      }
    } catch {
      // Fall through to the cached or browser zone below.
    }

    // Not cached on this path: a fallback is not an answer, and caching it
    // would keep the workspace anchored to whoever first loaded it offline.
    inFlight = null

    return readCachedWorkspaceTimeZone() ?? resolveBrowserTimeZone()
  })()

  return inFlight
}

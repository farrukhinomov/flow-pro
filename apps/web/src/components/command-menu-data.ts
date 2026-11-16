import { useEffect, useState } from 'react'
import { applicationStore } from '@/application/application-store'
import { listEmployeeRequests } from '@/data/local/requests.repo'
import {
  getTimesheetVisibleEmployees,
  type AppViewer,
} from '@/domain/access/access-control'
import type { EmployeeRequest } from '@/domain/requests/types'
import type { EmployeeUser } from '@/domain/users/types'

/**
 * Cap on how many of each entity the palette holds.
 *
 * The palette is a jump target, not a report: someone looking for one person
 * types their name. Holding the whole directory in memory to filter it in the
 * browser would be the wrong trade.
 */
const MAX_RESULTS = 50

export type CommandSearchData = {
  employees: EmployeeUser[]
  requests: EmployeeRequest[]
}

/**
 * Loads the entities the command palette can jump to.
 *
 * The palette previously listed only sidebar links and theme switches, so
 * pressing Cmd+K and typing a colleague's name found nothing — which is the
 * first thing anyone tries.
 *
 * Results are scoped with the same helpers the pages use. Employees run through
 * `getTimesheetVisibleEmployees`, and requests are limited to the viewer's own,
 * so the palette can never become a way around the visibility rules that the
 * directory and approval screens enforce.
 */
export function useCommandSearchData(
  open: boolean,
  viewer: AppViewer
): CommandSearchData {
  const [data, setData] = useState<CommandSearchData>({
    employees: [],
    requests: [],
  })

  useEffect(() => {
    // Loaded on open rather than on mount: the palette lives in a provider that
    // wraps every authenticated page, and most sessions never open it.
    if (!open) return

    let cancelled = false

    void Promise.all([applicationStore.listUsers({}), listEmployeeRequests()])
      .then(([users, requests]) => {
        if (cancelled) return

        setData({
          employees: getTimesheetVisibleEmployees({
            employees: users,
            viewer,
          }).slice(0, MAX_RESULTS),
          requests: requests
            .filter((request) => request.employeeId === viewer.employeeId)
            .slice(0, MAX_RESULTS),
        })
      })
      .catch(() => {
        // The palette still navigates without data; a failed load must not
        // break the one control that reaches every other page.
        if (!cancelled) setData({ employees: [], requests: [] })
      })

    return () => {
      cancelled = true
    }
  }, [open, viewer])

  return data
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAttendancePolicyConfigBackendFirst } from '@/data/attendance-policy.gateway'
import { listTimeCorrectionsForEmployee } from '@/data/local/attendance.repo'
import { subscribeToAttendanceSync } from '@/data/sync/sync-engine'
import { getDefaultAttendancePolicyConfig } from '@/domain/attendance/policies'
import type {
  AppliedTimeCorrection,
  AttendancePolicyConfig,
  ClockEvent,
} from '@/domain/attendance/types'
import type { EmployeeRequest } from '@/domain/requests/types'
import type { EmployeeUser } from '@/domain/users/types'
import type { Locale } from '@/i18n'
import {
  buildEmployeeTimesheetRows,
  resolveTimesheetWorkContract,
} from '@/features/timesheet/timesheet-projection'
import type { DayRow } from '@/features/timesheet/types'

export function useTodayTimesheetRows({
  days,
  employeeId,
  events,
  locale,
  requests,
  users,
}: {
  days: Date[]
  employeeId: string
  events: ClockEvent[]
  locale: Locale
  requests: EmployeeRequest[]
  users: EmployeeUser[]
}) {
  const [corrections, setCorrections] = useState<AppliedTimeCorrection[]>([])
  const [policyConfig, setPolicyConfig] =
    useState<AttendancePolicyConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [nextCorrections, nextPolicyConfig] = await Promise.all([
        listTimeCorrectionsForEmployee(employeeId),
        getAttendancePolicyConfigBackendFirst(),
      ])

      setCorrections(nextCorrections)
      setPolicyConfig(nextPolicyConfig)
    } catch {
      setCorrections([])
      setPolicyConfig(getDefaultAttendancePolicyConfig())
    } finally {
      setIsLoading(false)
    }
  }, [employeeId])

  useEffect(() => {
    const runRefresh = () => {
      void refresh()
    }
    const initialRefresh = window.setTimeout(runRefresh, 0)
    const unsubscribe = subscribeToAttendanceSync(runRefresh)

    return () => {
      window.clearTimeout(initialRefresh)
      unsubscribe()
    }
  }, [refresh])

  const rows = useMemo(() => {
    const employee = users.find((user) => user.id === employeeId)
    const workContract = resolveTimesheetWorkContract({
      employee,
      employeeId,
      policyConfig,
    })
    const periods = Array.from(
      new Set(days.map((day) => toLocalDate(day).slice(0, 7)))
    )
    const rowsByDate = new Map<string, DayRow>()

    periods.forEach((periodMonth) => {
      buildEmployeeTimesheetRows({
        corrections,
        employeeId,
        events,
        locale,
        periodMonth,
        regionCode: policyConfig?.regionCode,
        requests,
        workContract,
      }).forEach((row) => rowsByDate.set(row.date, row))
    })

    return days.flatMap((day) => {
      const row = rowsByDate.get(toLocalDate(day))

      return row ? [row] : []
    })
  }, [
    corrections,
    days,
    employeeId,
    events,
    locale,
    policyConfig,
    requests,
    users,
  ])

  return { isLoading, rows }
}

function toLocalDate(day: Date) {
  const year = day.getFullYear()
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const date = String(day.getDate()).padStart(2, '0')

  return `${year}-${month}-${date}`
}

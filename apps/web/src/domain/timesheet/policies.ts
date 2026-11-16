import type { WorkContract } from '@/domain/attendance/types'

export const defaultWorkContract: WorkContract = {
  id: 'contract-marta-40h-2026',
  employeeId: 'usr-marta-lindgren',
  effectiveFrom: '2026-01-01',
  weeklyHours: 40,
  workdays: [1, 2, 3, 4, 5],
  dailyHours: {
    1: 8,
    2: 8,
    3: 8,
    4: 8,
    5: 8,
  },
}

export function getTargetHoursForDate(contract: WorkContract, date: string) {
  const weekday = new Date(`${date}T12:00:00`).getDay()

  if (!contract.workdays.includes(weekday)) return undefined

  return (
    contract.dailyHours[weekday] ??
    contract.weeklyHours / contract.workdays.length
  )
}

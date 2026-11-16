import type {
  AttendanceCategory,
  VisibilityLevel,
} from '@/domain/attendance/types'
import type { EmployeeRequest } from '@/domain/requests/types'
import type { EmployeeUser } from '@/domain/users/types'

export type PlanningEntry = {
  date: string
  code?: string
  label?: string
  color?: string
  category?: AttendanceCategory
  visibility: VisibilityLevel
  isAnon?: boolean
  isPending?: boolean
}

export type PlanningPerson = {
  id: string
  name: string
  displayName: string
  role: string
  team: string
  entries: PlanningEntry[]
  user: EmployeeUser
}

export type PlanningPackage = {
  periodMonth: string
  generatedAt: string
  people: PlanningPerson[]
  requests: EmployeeRequest[]
}

export type AvailabilityStatus =
  'available' | 'remote' | 'unavailable' | 'absent'

export type TeamAvailabilityMember = {
  id: string
  name: string
  role: string
  team: string
  status: AvailabilityStatus
  policy: 'state-only' | 'operational' | 'confidential'
  until?: string
  note?: string
  nextWorkingDay?: string
}

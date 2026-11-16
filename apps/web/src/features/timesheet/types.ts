import type { AppliedTimeCorrection } from '@/domain/attendance/types'
import type { LucideIcon } from 'lucide-react'

export type DayRow = {
  date: string
  label: string
  isWeekend: boolean
  isHoliday: boolean
  holidayName?: string
  absences: string[]
  clockIns: string[]
  clockOuts: string[]
  prod?: number
  target?: number
  total?: number
  paid?: number
  flex?: number
  breakSet?: number
  breakTaken?: number
  breakDiff?: number
  correction?: AppliedTimeCorrection
}

export type SummaryRow = {
  label: string
  startValue?: string
  sum?: string
  result?: string
  current?: string
}

export type HolidayStats = {
  annual: number
  disability: number
  extra1: number
  extra2: number
  fromPrev: number
  expired: number
  taken: number
  remaining: number
  planned: number
  available: number
}

export type DayBadge = {
  labelKey: string
  tone: 'default' | 'muted' | 'success' | 'warning' | 'danger' | 'remote'
  icon?: LucideIcon
}

export type TimesheetMetrics = {
  breaks: number
  flex: number
  paid: number
  target: number
  worked: number
}

export type TimelineSegment = {
  id: string
  start: string
  end: string
  marker: string | undefined
  left: number
  width: number
  tone: 'work' | 'remote' | 'break' | 'overtime' | 'late'
}

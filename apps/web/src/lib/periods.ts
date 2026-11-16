import { addMonths, format, parse, startOfMonth, startOfYear } from 'date-fns'

export function getCurrentMonthDate() {
  return startOfMonth(new Date())
}

export function getCurrentYearDate() {
  return startOfYear(new Date())
}

export function formatPeriodMonth(date: Date) {
  return format(startOfMonth(date), 'yyyy-MM')
}

export function parsePeriodMonth(periodMonth: string) {
  return startOfMonth(parse(`${periodMonth}-01`, 'yyyy-MM-dd', new Date()))
}

export function buildPeriodMonthRange({
  start,
  length,
}: {
  start: Date
  length: number
}) {
  return Array.from({ length }, (_, index) =>
    formatPeriodMonth(addMonths(startOfMonth(start), index))
  )
}

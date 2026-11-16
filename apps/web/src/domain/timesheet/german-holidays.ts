import type { PublicHoliday } from '@/domain/attendance/types'

/**
 * Statutory public holidays in Germany, computed for any year and any federal state.
 *
 * Public holidays are set by the states, not the federation, so the count differs by where
 * an employee works: Bayern observes thirteen, Berlin ten. Because a public holiday counts
 * toward target hours, getting the set wrong misstates flex balances and payroll, which is
 * the working-time record an employer has to be able to defend.
 *
 * Movable feasts are derived from Easter rather than listed per year, so the calendar stays
 * correct without anyone maintaining a table each December.
 */

/** The sixteen federal states, by their ISO 3166-2:DE codes. */
export const GERMAN_STATE_CODES = [
  'BW',
  'BY',
  'BE',
  'BB',
  'HB',
  'HH',
  'HE',
  'MV',
  'NI',
  'NW',
  'RP',
  'SL',
  'SN',
  'ST',
  'SH',
  'TH',
] as const

export type GermanStateCode = (typeof GERMAN_STATE_CODES)[number]

export function isGermanStateCode(value: string): value is GermanStateCode {
  return (GERMAN_STATE_CODES as readonly string[]).includes(value)
}

/**
 * Easter Sunday for a Gregorian year, via the Anonymous Gregorian algorithm.
 *
 * Every movable German holiday is a fixed offset from this date, so it is the only piece of
 * calendar arithmetic the rest of the module needs.
 */
export function getEasterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1

  return new Date(Date.UTC(year, month - 1, day))
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function fixedDate(year: number, month: number, day: number) {
  return toIsoDate(new Date(Date.UTC(year, month - 1, day)))
}

/**
 * Buß- und Bettag falls on the Wednesday before 23 November, and is a public holiday only in
 * Sachsen.
 */
function getRepentanceDay(year: number) {
  const reference = new Date(Date.UTC(year, 10, 23))
  const daysSinceWednesday = (reference.getUTCDay() + 4) % 7 || 7
  return toIsoDate(addDays(reference, -daysSinceWednesday))
}

type HolidayDefinition = {
  key: string
  name: string
  date: string
  /** Omitted where the holiday is observed nationwide. */
  states?: readonly GermanStateCode[]
}

function getHolidayDefinitions(year: number): HolidayDefinition[] {
  const easter = getEasterSunday(year)
  const fromEaster = (offset: number) => toIsoDate(addDays(easter, offset))

  return [
    // Nationwide, per Einigungsvertrag and the states' own holiday acts.
    { key: 'neujahr', name: 'Neujahr', date: fixedDate(year, 1, 1) },
    { key: 'karfreitag', name: 'Karfreitag', date: fromEaster(-2) },
    { key: 'ostermontag', name: 'Ostermontag', date: fromEaster(1) },
    {
      key: 'tag-der-arbeit',
      name: 'Tag der Arbeit',
      date: fixedDate(year, 5, 1),
    },
    {
      key: 'christi-himmelfahrt',
      name: 'Christi Himmelfahrt',
      date: fromEaster(39),
    },
    { key: 'pfingstmontag', name: 'Pfingstmontag', date: fromEaster(50) },
    {
      key: 'tag-der-deutschen-einheit',
      name: 'Tag der Deutschen Einheit',
      date: fixedDate(year, 10, 3),
    },
    {
      key: 'erster-weihnachtstag',
      name: '1. Weihnachtstag',
      date: fixedDate(year, 12, 25),
    },
    {
      key: 'zweiter-weihnachtstag',
      name: '2. Weihnachtstag',
      date: fixedDate(year, 12, 26),
    },

    // Observed only in the states listed.
    {
      key: 'heilige-drei-koenige',
      name: 'Heilige Drei Könige',
      date: fixedDate(year, 1, 6),
      states: ['BW', 'BY', 'ST'],
    },
    {
      key: 'internationaler-frauentag',
      name: 'Internationaler Frauentag',
      date: fixedDate(year, 3, 8),
      states: ['BE', 'MV'],
    },
    {
      key: 'fronleichnam',
      name: 'Fronleichnam',
      date: fromEaster(60),
      states: ['BW', 'BY', 'HE', 'NW', 'RP', 'SL'],
    },
    {
      // In Bayern this depends on the municipality's confessional majority, which needs data
      // this product does not hold, so only the state-wide case is claimed here.
      key: 'mariae-himmelfahrt',
      name: 'Mariä Himmelfahrt',
      date: fixedDate(year, 8, 15),
      states: ['SL'],
    },
    {
      key: 'weltkindertag',
      name: 'Weltkindertag',
      date: fixedDate(year, 9, 20),
      states: ['TH'],
    },
    {
      key: 'reformationstag',
      name: 'Reformationstag',
      date: fixedDate(year, 10, 31),
      states: ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH'],
    },
    {
      key: 'allerheiligen',
      name: 'Allerheiligen',
      date: fixedDate(year, 11, 1),
      states: ['BW', 'BY', 'NW', 'RP', 'SL'],
    },
    {
      key: 'buss-und-bettag',
      name: 'Buß- und Bettag',
      date: getRepentanceDay(year),
      states: ['SN'],
    },
  ]
}

/**
 * Statutory holidays for a year, narrowed to one federal state.
 *
 * `stateCode` accepts anything so callers can pass a stored configuration value directly; an
 * unrecognised code yields the nationwide set, which is the safe subset every state observes.
 */
export function findGermanPublicHoliday(
  isoDate: string,
  stateCode?: string
): PublicHoliday | undefined {
  const year = Number(isoDate.slice(0, 4))
  if (!Number.isFinite(year)) return undefined

  return getGermanPublicHolidays(year, stateCode).find(
    (holiday) => holiday.date === isoDate
  )
}

export function getGermanPublicHolidays(
  year: number,
  stateCode?: string
): PublicHoliday[] {
  const state =
    stateCode && isGermanStateCode(stateCode) ? stateCode : undefined

  return getHolidayDefinitions(year)
    .filter(
      (holiday) => !holiday.states || (state && holiday.states.includes(state))
    )
    .map<PublicHoliday>((holiday) => ({
      id: `holiday-de-${state ?? 'bund'}-${year}-${holiday.key}`,
      date: holiday.date,
      name: holiday.name,
      region: state ? `DE-${state}` : 'DE',
      source: 'seed',
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

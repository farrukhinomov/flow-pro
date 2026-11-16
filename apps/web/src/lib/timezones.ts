/**
 * The IANA time zones this browser knows about.
 *
 * Account settings previously offered a hardcoded list of five European zones,
 * so anyone working outside Berlin, Vienna, Zurich, London, or UTC could not
 * set their own — including remote staff at German companies.
 *
 * `Intl.supportedValuesOf` is available in every browser this app targets, but
 * it is guarded because it is the newest API used here and a missing zone list
 * should degrade rather than blank the settings page.
 */
const FALLBACK_TIME_ZONES = [
  'Europe/Berlin',
  'Europe/London',
  'Europe/Vienna',
  'Europe/Zurich',
  'UTC',
]

/**
 * `Intl.supportedValuesOf` is ES2022 and the project compiles against the
 * ES2020 lib, so it is declared here rather than widening the lib target for
 * every file. The runtime call is still guarded.
 */
type IntlWithSupportedValues = {
  supportedValuesOf?: (key: 'timeZone') => string[]
}

let cachedTimeZones: string[] | null = null

export function listSupportedTimeZones(): string[] {
  if (cachedTimeZones) return cachedTimeZones

  try {
    const supported = (Intl as IntlWithSupportedValues).supportedValuesOf?.(
      'timeZone'
    )

    cachedTimeZones = supported?.length ? [...supported] : FALLBACK_TIME_ZONES
  } catch {
    cachedTimeZones = FALLBACK_TIME_ZONES
  }

  return cachedTimeZones
}

/** The browser's own zone, used as the default for a new account. */
export function resolveBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * Formats a zone for a picker: `Europe/Berlin (GMT+2)`.
 *
 * The offset is resolved for the given instant rather than hardcoded, so zones
 * observing daylight saving read correctly year-round.
 */
export function formatTimeZoneLabel(timeZone: string, at: Date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      timeZoneName: 'shortOffset',
    }).formatToParts(at)
    const offset = parts.find((part) => part.type === 'timeZoneName')?.value

    return offset ? `${timeZone} (${offset})` : timeZone
  } catch {
    return timeZone
  }
}

export function listTimeZoneOptions(at: Date = new Date()) {
  return listSupportedTimeZones().map((timeZone) => ({
    label: formatTimeZoneLabel(timeZone, at),
    value: timeZone,
  }))
}

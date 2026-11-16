export type DeviceDescription = {
  browser: string | null
  os: string | null
}

// Order matters: Edge and Opera also announce Chrome, and Chrome also announces Safari.
const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]

const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
]

/**
 * A rough, human-readable name for the device behind a session, such as "Firefox on Windows".
 * It only helps people recognise their own sessions; nothing relies on it being accurate.
 */
export function describeUserAgent(
  userAgent: string | null | undefined
): DeviceDescription {
  if (!userAgent) return { browser: null, os: null }

  return {
    browser: BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null,
    os: SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null,
  }
}

import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  type Locale,
} from './messages'
import { interpolate, resolveMessage } from './resolve'

function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

function readStaticLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  return stored && isLocale(stored) ? stored : DEFAULT_LOCALE
}

export function tStatic(key: string, vars?: Record<string, string | number>) {
  const locale = readStaticLocale()
  const message =
    resolveMessage(locale, key) ?? resolveMessage(DEFAULT_LOCALE, key) ?? key

  return interpolate(message, vars)
}

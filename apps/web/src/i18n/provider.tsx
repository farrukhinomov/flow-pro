import { useEffect, useMemo, useState } from 'react'
import { I18nContext, type I18nContextValue } from './context'
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

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  if (stored && isLocale(stored)) return stored

  const browserLocale = window.navigator.language.toLowerCase().split('-')[0]
  if (isLocale(browserLocale)) return browserLocale

  return DEFAULT_LOCALE
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => readStoredLocale())

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    }

    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale
    }
  }, [locale])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => {
        const localized = resolveMessage(locale, key)
        const fallback = resolveMessage(DEFAULT_LOCALE, key)
        const template = localized ?? fallback ?? key

        return interpolate(template, vars)
      },
    }),
    [locale]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

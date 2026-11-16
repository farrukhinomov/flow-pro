import type { LifecycleSummary } from '@/domain/users/lifecycle'
import type { Locale } from '@/i18n'
import { formatShortDate } from '@/i18n/format'

type Translate = (key: string, vars?: Record<string, string | number>) => string

/**
 * Renders a {@link LifecycleSummary} in the viewer's language.
 *
 * The domain returns a key plus the raw retention date so it stays free of
 * React and i18n; this is the single place that turns it into display copy.
 */
export function translateLifecycleSummary(
  summary: LifecycleSummary,
  locale: Locale,
  t: Translate
) {
  if (!summary.retentionUntil) return t(summary.key)

  return t(summary.key, {
    date: formatShortDate(summary.retentionUntil, locale),
  })
}

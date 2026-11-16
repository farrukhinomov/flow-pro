import { messages, type Locale } from './messages'

/**
 * Looks up a dotted message key in the message tree.
 *
 * Shared by the provider, the static translator, and the API error resolver so
 * all three agree on what "the key exists" means. It previously existed as two
 * identical private copies.
 */
export function resolveMessage(locale: Locale, key: string) {
  const path = key.split('.')
  let current: unknown = messages[locale]

  for (const segment of path) {
    if (!current || typeof current !== 'object') return null
    current = (current as Record<string, unknown>)[segment]
  }

  return typeof current === 'string' ? current : null
}

/** True when a message exists for the key, used to decide on a fallback. */
export function hasMessage(locale: Locale, key: string) {
  return resolveMessage(locale, key) !== null
}

export function interpolate(
  template: string,
  vars?: Record<string, string | number>
) {
  if (!vars) return template

  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    String(vars[key] ?? `{{${key}}}`)
  )
}

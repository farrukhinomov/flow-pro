import { logger } from './logger'

/**
 * Loads data a page can do without: resolves to what `source` yields, or to `fallback` when it
 * fails, so one failing source cannot blank the rest of the page.
 *
 * Pages load several sources together, and with a plain `Promise.all` any one failure discarded
 * all of them: a user directory the viewer may not read once left the request form without its
 * absence types. Use it for secondary data such as the sync status, the attendance policy or the
 * people list; let the data the page exists to show fail loudly. The failure is logged.
 *
 * @param fallback The value to use instead, or a function that loads it, such as a local cache.
 */
export async function optionalSource<T>(
  source: Promise<T>,
  fallback: T | (() => T | Promise<T>),
  label: string
): Promise<T> {
  try {
    return await source
  } catch (error) {
    logger.error(
      error,
      `Could not load ${label}; the page continues without it`
    )
    return typeof fallback === 'function'
      ? await (fallback as () => T | Promise<T>)()
      : fallback
  }
}

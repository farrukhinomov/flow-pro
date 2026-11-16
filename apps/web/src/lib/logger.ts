/* eslint-disable no-console */
type LogContext = Record<string, unknown>

function shouldLogDebug() {
  return import.meta.env.DEV
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (!shouldLogDebug()) return

    console.debug(message, context ?? '')
  },

  error(error: unknown, message = 'Unexpected error') {
    if (!shouldLogDebug()) return

    console.error(message, error)
  },
}

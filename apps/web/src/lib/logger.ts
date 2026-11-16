/* eslint-disable no-console */
type LogContext = Record<string, unknown>

// `import.meta.env` exists only in Vite builds. Outside them, such as in the
// unit tests, logging stays quiet instead of throwing from an error handler.
function shouldLogDebug() {
  return import.meta.env?.DEV === true
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

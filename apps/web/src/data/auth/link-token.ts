import { useEffect, useState } from 'react'

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

/**
 * Reads the single-use token that email links carry as `#token=...`.
 *
 * The token sits in the URL fragment so it never reaches a server log or a `Referer` header.
 * Returns null when there is none or it is not shaped like a token.
 */
export function readLinkToken(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token')

  return token && TOKEN_PATTERN.test(token) ? token : null
}

/**
 * The link token of the current page. After the first render the fragment is removed from the
 * address bar and the history entry, so the token does not linger where it could be copied.
 */
export function useLinkToken(): string | null {
  const [token] = useState(() => readLinkToken(window.location.hash))

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}`
      )
    }

    // Opening a newer link in the same tab changes only the fragment, which browsers treat as a
    // jump within the page rather than a new page. Reload so the new token is read.
    const onHashChange = () => {
      if (readLinkToken(window.location.hash)) window.location.reload()
    }

    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return token
}

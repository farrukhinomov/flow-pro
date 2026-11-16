import { useEffect, useState } from 'react'

/**
 * Visually hidden live region for announcing state changes to screen readers.
 *
 * FlowPro had two `aria-live` regions in the whole application, so the actions
 * that matter most — clocking in, a filter changing the visible rows, a table
 * finishing its load — changed the screen silently. Toasts are announced by
 * Sonner, but a toast says "Booking saved"; it does not say that you are now
 * working, which is the information the page actually conveys.
 *
 * `polite` waits for the reader to finish its current sentence and is right for
 * everything here. Reserve `assertive` for content the user must hear
 * immediately, which interrupts them.
 */
export function LiveRegion({
  message,
  mode = 'polite',
}: {
  message: string
  mode?: 'polite' | 'assertive'
}) {
  // The region must be in the DOM before the text changes, otherwise some
  // readers skip the first announcement. Rendering an empty region on mount and
  // filling it on the next tick guarantees a change event.
  const [announced, setAnnounced] = useState('')

  useEffect(() => {
    const timeout = window.setTimeout(() => setAnnounced(message), 100)

    return () => window.clearTimeout(timeout)
  }, [message])

  return (
    <div aria-live={mode} aria-atomic='true' className='sr-only' role='status'>
      {announced}
    </div>
  )
}

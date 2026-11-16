/**
 * Markers shared by timesheet row building and timeline rendering.
 *
 * These are the short codes written into a day's segment markers, so both the
 * projection that produces rows and the chart that draws them must agree on the
 * exact strings. Kept in one module so the split between those two concerns
 * cannot let them drift apart.
 */
export const HOME_OFFICE_MARKER = 'HO'
export const BREAK_MARKER = 'Pa'

/** Rendered in place of a clock-out that has not happened yet. */
export const OPEN_CLOCK_OUT = '--:--'

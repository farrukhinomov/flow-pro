/**
 * Shared CSV primitives for every FlowPro export.
 *
 * Export safety used to live only in `domain/timesheet/exports.ts`, so the
 * planning, team-availability, audit, and reports exports shipped without
 * formula neutralization or a UTF-8 BOM. Both are file-format concerns rather
 * than business rules, so they belong in one place that every export path uses.
 *
 * This module is intentionally dependency-free so `domain` code may import it.
 */

const UTF8_BOM = '﻿'

/** Cells that must be quoted: separator, quote, or any newline form. */
const NEEDS_QUOTING = /[",\r\n]/

/**
 * A plain number such as `-1.50` or `42`. Matched before formula neutralization
 * so pre-formatted numeric columns keep their sign instead of being quoted into
 * text by the leading `-`.
 */
const NUMERIC_LITERAL = /^-?\d+(?:\.\d+)?$/

/**
 * Characters that make Excel/Sheets evaluate a cell as a formula.
 *
 * `-` is included because `-1+1` is evaluated, but {@link NUMERIC_LITERAL} is
 * checked first so ordinary negative numbers are left alone.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/

export type CsvValue = string | number | boolean | null | undefined

/**
 * Neutralizes spreadsheet formula injection.
 *
 * A text cell beginning with a formula trigger is executed on open, which turns
 * any user-controlled field (an employee name, a request reason, an audit
 * detail) into a code-execution and data-exfiltration vector for whoever opens
 * the export. Prefixing an apostrophe forces Excel to treat the cell as literal
 * text.
 */
export function neutralizeCsvFormula(value: string) {
  if (NUMERIC_LITERAL.test(value)) return value

  return FORMULA_TRIGGER.test(value) ? `'${value}` : value
}

/** Quotes a cell for RFC 4180 when it contains a separator, quote, or newline. */
export function csvEscape(value: CsvValue) {
  const text = value === null || value === undefined ? '' : String(value)

  if (!NEEDS_QUOTING.test(text)) return text

  return `"${text.replace(/"/g, '""')}"`
}

/** Neutralizes then escapes a single cell. Use for all user-controlled values. */
export function csvCell(value: CsvValue) {
  const text = value === null || value === undefined ? '' : String(value)

  return csvEscape(neutralizeCsvFormula(text))
}

/**
 * Builds CSV text from rows. Every cell is neutralized and escaped, so callers
 * pass raw values and never hand-roll quoting.
 *
 * The result deliberately carries no BOM: the BOM belongs to the file, not the
 * content, so callers that render or diff CSV text stay unaffected. Apply
 * {@link withUtf8Bom} at the download boundary.
 */
export function buildCsv(rows: readonly (readonly CsvValue[])[]) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

/**
 * Prefixes a UTF-8 byte order mark for spreadsheet consumers.
 *
 * Excel reads a CSV using the system ANSI code page unless the file opens with
 * a BOM, which renders German names such as "Müller" as "MÃ¼ller" and corrupts
 * payroll records. Applying it twice is a no-op.
 */
export function withUtf8Bom(content: string) {
  return content.startsWith(UTF8_BOM) ? content : `${UTF8_BOM}${content}`
}

/**
 * Escapes user-controlled values before interpolation into export HTML.
 *
 * The PDF export writes this markup into a new window and prints it, so an
 * unescaped name or request subtype could otherwise inject markup or script.
 */
export function htmlEscape(value: CsvValue) {
  const text = value === null || value === undefined ? '' : String(value)

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

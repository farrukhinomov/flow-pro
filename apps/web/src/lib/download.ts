import { withUtf8Bom } from './csv'

/**
 * Single browser download boundary for every FlowPro export.
 *
 * This replaces five near-identical copies that each recreated the anchor
 * dance. Two defects were repeated in all of them and are fixed here:
 *
 * - The anchor was never attached to the document. Firefox ignores `click()` on
 *   a detached anchor, so exports silently did nothing there.
 * - `revokeObjectURL` ran synchronously after `click()`, which can cancel the
 *   download before the browser has read the blob. Revocation is deferred to
 *   the next task instead.
 */
function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'

  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)

  // Defer revocation so the browser can start reading the blob first.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Downloads an already-built blob, such as an artifact fetched from the API. */
export function downloadBlobFile(filename: string, blob: Blob) {
  triggerDownload(filename, blob)
}

/** Downloads UTF-8 text under an explicit MIME type. */
export function downloadTextFile(
  filename: string,
  content: string,
  type: string
) {
  triggerDownload(filename, new Blob([content], { type }))
}

/**
 * Downloads CSV text as a spreadsheet-safe file.
 *
 * Always prefixes the UTF-8 BOM so Excel keeps umlauts intact. Route every CSV
 * export through this rather than {@link downloadTextFile} so no export can
 * regress to mojibake for German names.
 */
export function downloadCsvFile(filename: string, csv: string) {
  triggerDownload(
    filename,
    new Blob([withUtf8Bom(csv)], { type: 'text/csv;charset=utf-8' })
  )
}

/** Downloads pretty-printed JSON, used by audit and local-data exports. */
export function downloadJsonFile(filename: string, payload: unknown) {
  triggerDownload(
    filename,
    new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
  )
}

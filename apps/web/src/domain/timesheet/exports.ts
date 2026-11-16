import type { MonthlyTimesheetApproval } from '@/domain/attendance/types'
import { buildCsv, htmlEscape } from '@/lib/csv'

export { withUtf8Bom } from '@/lib/csv'

export type PayrollExportRow = {
  date: string
  status: string
  workedHours: number
  paidHours: number
  targetHours: number
  flexHours: number
  breakHours: number
}

export type PayrollExport = {
  employeeId: string
  employeeName: string
  periodMonth: string
  exportedAt: string
  approval: MonthlyTimesheetApproval | null
  totals: {
    workedHours: number
    paidHours: number
    targetHours: number
    flexHours: number
    breakHours: number
  }
  rows: PayrollExportRow[]
}

function timesheetExportLabels(locale = 'en') {
  if (locale === 'de') {
    return {
      approvalStatus: 'Freigabestatus',
      break: 'Pause',
      breakHours: 'Pausenstunden',
      date: 'Datum',
      employee: 'Mitarbeiter',
      employeeId: 'Mitarbeiter-ID',
      exported: 'Exportiert',
      flex: 'Flex',
      flexHours: 'Flexstunden',
      monthlyApproval: 'Monatliche Freigabe',
      paid: 'Bezahlt',
      paidHours: 'Bezahlte Stunden',
      period: 'Periode',
      signedAt: 'Signiert am',
      signedBy: 'Signiert von',
      status: 'Status',
      target: 'Soll',
      targetHours: 'Sollstunden',
      title: 'FlowPro Zeiterfassung',
      worked: 'Geleistet',
      workedHours: 'Geleistete Stunden',
      open: 'offen',
    }
  }

  return {
    approvalStatus: 'Approval status',
    break: 'Break',
    breakHours: 'Break hours',
    date: 'Date',
    employee: 'Employee',
    employeeId: 'Employee ID',
    exported: 'Exported',
    flex: 'Flex',
    flexHours: 'Flex hours',
    monthlyApproval: 'Monthly approval',
    paid: 'Paid',
    paidHours: 'Paid hours',
    period: 'Period',
    signedAt: 'Signed at',
    signedBy: 'Signed by',
    status: 'Status',
    target: 'Target',
    targetHours: 'Target hours',
    title: 'FlowPro Timesheet',
    worked: 'Worked',
    workedHours: 'Worked hours',
    open: 'open',
  }
}

export function buildPayrollCsv(exportData: PayrollExport, locale = 'en') {
  const labels = timesheetExportLabels(locale)
  const header = [
    labels.employeeId,
    labels.employee,
    labels.period,
    labels.date,
    labels.status,
    labels.workedHours,
    labels.paidHours,
    labels.targetHours,
    labels.flexHours,
    labels.breakHours,
    labels.approvalStatus,
    labels.signedAt,
  ]

  const rows = exportData.rows.map((row) => [
    exportData.employeeId,
    exportData.employeeName,
    exportData.periodMonth,
    row.date,
    row.status,
    row.workedHours.toFixed(2),
    row.paidHours.toFixed(2),
    row.targetHours.toFixed(2),
    row.flexHours.toFixed(2),
    row.breakHours.toFixed(2),
    exportData.approval?.status ?? labels.open,
    exportData.approval?.signedAt ?? '',
  ])

  return buildCsv([header, ...rows])
}

export function buildTimesheetPdfHtml(
  exportData: PayrollExport,
  locale = 'en'
) {
  const labels = timesheetExportLabels(locale)
  const totals = exportData.totals
  const employeeName = htmlEscape(exportData.employeeName)
  const periodMonth = htmlEscape(exportData.periodMonth)
  const exportedAt = htmlEscape(exportData.exportedAt)
  const approvalStatus = htmlEscape(exportData.approval?.status ?? labels.open)
  const signedByName = htmlEscape(exportData.approval?.signedByName ?? '-')
  const signedAt = htmlEscape(exportData.approval?.signedAt ?? '-')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
	    <title>${labels.title} ${periodMonth}</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; margin: 32px; color: #111827; }
      h1 { font-size: 24px; margin: 0 0 4px; }
      .muted { color: #6b7280; }
      .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin: 24px 0; }
      .metric { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
      .metric div:first-child { color: #6b7280; font-size: 12px; }
      .metric div:last-child { font-size: 18px; font-weight: 700; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border-bottom: 1px solid #e5e7eb; padding: 8px; text-align: right; }
      th:first-child, td:first-child, th:nth-child(2), td:nth-child(2) { text-align: left; }
      th { background: #f9fafb; color: #4b5563; }
      .signature { margin-top: 28px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
    </style>
  </head>
  <body>
	    <h1>${labels.title}</h1>
	    <div class="muted">${employeeName} · ${periodMonth} · ${labels.exported} ${exportedAt}</div>
	    <div class="grid">
	      <div class="metric"><div>${labels.worked}</div><div>${totals.workedHours.toFixed(2)}</div></div>
	      <div class="metric"><div>${labels.paid}</div><div>${totals.paidHours.toFixed(2)}</div></div>
	      <div class="metric"><div>${labels.target}</div><div>${totals.targetHours.toFixed(2)}</div></div>
	      <div class="metric"><div>${labels.flex}</div><div>${totals.flexHours.toFixed(2)}</div></div>
	      <div class="metric"><div>${labels.break}</div><div>${totals.breakHours.toFixed(2)}</div></div>
    </div>
    <table>
      <thead>
	        <tr><th>${labels.date}</th><th>${labels.status}</th><th>${labels.worked}</th><th>${labels.paid}</th><th>${labels.target}</th><th>${labels.flex}</th><th>${labels.break}</th></tr>
      </thead>
      <tbody>
        ${exportData.rows
          .map(
            (row) =>
              `<tr><td>${htmlEscape(row.date)}</td><td>${htmlEscape(row.status)}</td><td>${row.workedHours.toFixed(2)}</td><td>${row.paidHours.toFixed(2)}</td><td>${row.targetHours.toFixed(2)}</td><td>${row.flexHours.toFixed(2)}</td><td>${row.breakHours.toFixed(2)}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>
    <div class="signature">
	      <strong>${labels.monthlyApproval}</strong><br />
	      ${labels.status}: ${approvalStatus}<br />
	      ${labels.signedBy}: ${signedByName}<br />
	      ${labels.signedAt}: ${signedAt}
    </div>
  </body>
</html>`
}

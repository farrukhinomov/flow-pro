import type { ReportsPackage } from './types'

function numberFormat(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function labelsForLocale(locale: string) {
  if (locale === 'de') {
    return {
      absenceBalances: 'Abwesenheitssalden',
      annual: 'Jährlich',
      approval: 'Freigabe',
      approved: 'Genehmigt',
      breakIssues: 'Pausenprobleme',
      breakOk: 'Pause OK',
      complianceIssues: 'Compliance-Probleme',
      date: 'Datum',
      employee: 'Mitarbeiter',
      flex: 'Flex',
      generated: 'Erstellt',
      headcount: 'Mitarbeiterzahl',
      homeOffice: 'Homeoffice',
      no: 'Nein',
      open: 'Offen',
      paid: 'Bezahlt',
      payroll: 'Payroll',
      planned: 'Geplant',
      remaining: 'Verbleibend',
      reportsTitle: 'FlowPro Berichte',
      sickness: 'Krankheit',
      signed: 'Signiert',
      status: 'Status',
      target: 'Soll',
      team: 'Team',
      teamReport: 'Teambericht',
      worked: 'Geleistet',
      yes: 'Ja',
    }
  }

  return {
    absenceBalances: 'Absence balances',
    annual: 'Annual',
    approval: 'Approval',
    approved: 'Approved',
    breakIssues: 'Break issues',
    breakOk: 'Break OK',
    complianceIssues: 'Compliance issues',
    date: 'Date',
    employee: 'Employee',
    flex: 'Flex',
    generated: 'Generated',
    headcount: 'Headcount',
    homeOffice: 'Home office',
    no: 'No',
    open: 'Open',
    paid: 'Paid',
    payroll: 'Payroll',
    planned: 'Planned',
    remaining: 'Remaining',
    reportsTitle: 'FlowPro Reports',
    sickness: 'Sickness',
    signed: 'Signed',
    status: 'Status',
    target: 'Target',
    team: 'Team',
    teamReport: 'Team report',
    worked: 'Worked',
    yes: 'Yes',
  }
}

export function buildReportsExcelHtml(report: ReportsPackage, locale = 'en') {
  const labels = labelsForLocale(locale)
  const payrollRows = report.employeeReports
    .flatMap((employeeReport) =>
      employeeReport.days.map(
        (day) =>
          `<tr><td>${day.employeeName}</td><td>${day.date}</td><td>${day.status}</td><td>${numberFormat(day.workedHours, locale)}</td><td>${numberFormat(day.paidHours, locale)}</td><td>${numberFormat(day.targetHours, locale)}</td><td>${numberFormat(day.flexHours, locale)}</td><td>${day.breakCompliant ? labels.yes : labels.no}</td><td>${employeeReport.approval?.status ?? labels.open.toLowerCase()}</td></tr>`
      )
    )
    .join('')
  const balanceRows = report.absenceBalances
    .map(
      (balance) =>
        `<tr><td>${balance.employeeName}</td><td>${balance.annualVacationDays}</td><td>${balance.approvedVacationDays}</td><td>${balance.plannedVacationDays}</td><td>${balance.remainingVacationDays}</td><td>${balance.sicknessDays}</td><td>${balance.homeOfficeDays}</td></tr>`
    )
    .join('')
  const teamRows = report.teamReports
    .map(
      (team) =>
        `<tr><td>${team.team}</td><td>${team.headcount}</td><td>${team.signedPeriods}</td><td>${team.openPeriods}</td><td>${numberFormat(team.workedHours, locale)}</td><td>${numberFormat(team.targetHours, locale)}</td><td>${numberFormat(team.flexHours, locale)}</td><td>${team.complianceIssues}</td></tr>`
    )
    .join('')

  return `<!doctype html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <table>
	      <tr><th colspan="9">${labels.payroll} ${report.periodMonth}</th></tr>
	      <tr><th>${labels.employee}</th><th>${labels.date}</th><th>${labels.status}</th><th>${labels.worked}</th><th>${labels.paid}</th><th>${labels.target}</th><th>${labels.flex}</th><th>${labels.breakOk}</th><th>${labels.approval}</th></tr>
      ${payrollRows}
    </table>
    <br />
    <table>
	      <tr><th colspan="7">${labels.absenceBalances}</th></tr>
	      <tr><th>${labels.employee}</th><th>${labels.annual}</th><th>${labels.approved}</th><th>${labels.planned}</th><th>${labels.remaining}</th><th>${labels.sickness}</th><th>${labels.homeOffice}</th></tr>
      ${balanceRows}
    </table>
    <br />
    <table>
	      <tr><th colspan="8">${labels.teamReport}</th></tr>
	      <tr><th>${labels.team}</th><th>${labels.headcount}</th><th>${labels.signed}</th><th>${labels.open}</th><th>${labels.worked}</th><th>${labels.target}</th><th>${labels.flex}</th><th>${labels.complianceIssues}</th></tr>
      ${teamRows}
    </table>
  </body>
</html>`
}

export function buildReportsPdfHtml(report: ReportsPackage, locale = 'en') {
  const labels = labelsForLocale(locale)
  const totals = report.employeeReports.reduce(
    (sum, employeeReport) => ({
      complianceIssues:
        sum.complianceIssues + employeeReport.totals.complianceIssues,
      flexHours: sum.flexHours + employeeReport.totals.flexHours,
      paidHours: sum.paidHours + employeeReport.totals.paidHours,
      targetHours: sum.targetHours + employeeReport.totals.targetHours,
      workedHours: sum.workedHours + employeeReport.totals.workedHours,
    }),
    {
      complianceIssues: 0,
      flexHours: 0,
      paidHours: 0,
      targetHours: 0,
      workedHours: 0,
    }
  )

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
	    <title>${labels.reportsTitle} ${report.periodMonth}</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; margin: 32px; color: #111827; }
      h1 { font-size: 24px; margin: 0 0 4px; }
      h2 { font-size: 16px; margin: 28px 0 8px; }
      .muted { color: #6b7280; }
      .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin: 24px 0; }
      .metric { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
      .metric div:first-child { color: #6b7280; font-size: 12px; }
      .metric div:last-child { font-size: 18px; font-weight: 700; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border-bottom: 1px solid #e5e7eb; padding: 8px; text-align: right; }
      th:first-child, td:first-child, th:nth-child(2), td:nth-child(2) { text-align: left; }
      th { background: #f9fafb; color: #4b5563; }
    </style>
  </head>
  <body>
	    <h1>${labels.reportsTitle}</h1>
	    <div class="muted">${report.periodMonth} · ${labels.generated} ${new Intl.DateTimeFormat(
        locale,
        {
          dateStyle: 'medium',
          timeStyle: 'short',
        }
      ).format(new Date(report.generatedAt))}</div>
    <div class="grid">
	      <div class="metric"><div>${labels.worked}</div><div>${numberFormat(totals.workedHours, locale)}</div></div>
	      <div class="metric"><div>${labels.paid}</div><div>${numberFormat(totals.paidHours, locale)}</div></div>
	      <div class="metric"><div>${labels.target}</div><div>${numberFormat(totals.targetHours, locale)}</div></div>
	      <div class="metric"><div>${labels.flex}</div><div>${numberFormat(totals.flexHours, locale)}</div></div>
	      <div class="metric"><div>${labels.breakIssues}</div><div>${totals.complianceIssues}</div></div>
    </div>
	    <h2>${labels.teamReport}</h2>
    <table>
	      <thead><tr><th>${labels.team}</th><th>${labels.headcount}</th><th>${labels.signed}</th><th>${labels.open}</th><th>${labels.worked}</th><th>${labels.target}</th><th>${labels.flex}</th><th>${labels.breakIssues}</th></tr></thead>
      <tbody>
        ${report.teamReports
          .map(
            (team) =>
              `<tr><td>${team.team}</td><td>${team.headcount}</td><td>${team.signedPeriods}</td><td>${team.openPeriods}</td><td>${numberFormat(team.workedHours, locale)}</td><td>${numberFormat(team.targetHours, locale)}</td><td>${numberFormat(team.flexHours, locale)}</td><td>${team.complianceIssues}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>
	    <h2>${labels.absenceBalances}</h2>
    <table>
	      <thead><tr><th>${labels.employee}</th><th>${labels.annual}</th><th>${labels.approved}</th><th>${labels.planned}</th><th>${labels.remaining}</th><th>${labels.sickness}</th><th>${labels.homeOffice}</th></tr></thead>
      <tbody>
        ${report.absenceBalances
          .map(
            (balance) =>
              `<tr><td>${balance.employeeName}</td><td>${balance.annualVacationDays}</td><td>${balance.approvedVacationDays}</td><td>${balance.plannedVacationDays}</td><td>${balance.remainingVacationDays}</td><td>${balance.sicknessDays}</td><td>${balance.homeOfficeDays}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>
  </body>
</html>`
}

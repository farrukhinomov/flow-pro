import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildPayrollCsv,
  buildTimesheetPdfHtml,
  withUtf8Bom,
  type PayrollExport,
} from './exports'

function exportData(overrides: Partial<PayrollExport> = {}): PayrollExport {
  return {
    approval: null,
    employeeId: 'employee-1',
    employeeName: 'Hannah Fischer',
    exportedAt: '2026-06-01T08:00:00.000Z',
    periodMonth: '2026-05',
    rows: [
      {
        breakHours: 0.5,
        date: '2026-05-04',
        flexHours: -1.5,
        paidHours: 8,
        status: 'Workday',
        targetHours: 8,
        workedHours: 8,
      },
    ],
    totals: {
      breakHours: 0.5,
      flexHours: -1.5,
      paidHours: 8,
      targetHours: 8,
      workedHours: 8,
    },
    ...overrides,
  }
}

describe('timesheet exports', () => {
  it('builds a payroll csv with approval state', () => {
    const csv = buildPayrollCsv({
      approval: {
        employeeId: 'employee-1',
        id: 'approval-1',
        periodMonth: '2026-05',
        signedAt: '2026-05-31T12:00:00.000Z',
        signedById: 'manager-1',
        signedByName: 'Anna Manager',
        status: 'signed',
        updatedAt: '2026-05-31T12:00:00.000Z',
      },
      employeeId: 'employee-1',
      employeeName: 'Marta Lindgren',
      exportedAt: '2026-05-31T12:00:00.000Z',
      periodMonth: '2026-05',
      rows: [
        {
          breakHours: 0.5,
          date: '2026-05-04',
          flexHours: 0,
          paidHours: 8,
          status: 'Workday',
          targetHours: 8,
          workedHours: 8,
        },
      ],
      totals: {
        breakHours: 0.5,
        flexHours: 0,
        paidHours: 8,
        targetHours: 8,
        workedHours: 8,
      },
    })

    assert.match(csv, /Employee ID,Employee,Period/)
    assert.match(csv, /employee-1,Marta Lindgren,2026-05/)
    assert.match(csv, /signed,2026-05-31T12:00:00.000Z/)
  })

  it('neutralizes spreadsheet formula injection in CSV text cells', () => {
    const csv = buildPayrollCsv(
      exportData({
        employeeName: '=HYPERLINK("http://evil","click")',
        rows: [
          {
            breakHours: 0,
            date: '2026-05-04',
            flexHours: -1.5,
            paidHours: 8,
            status: '@SUM(A1:A9)',
            targetHours: 8,
            workedHours: 8,
          },
        ],
      })
    )

    // Dangerous text cells are prefixed with an apostrophe (then quoted by csvEscape).
    assert.ok(csv.includes(`"'=HYPERLINK`), 'formula name must be neutralized')
    assert.ok(
      csv.includes(`'@SUM(A1:A9)`),
      'formula status must be neutralized'
    )
    assert.ok(!/(^|,)=HYPERLINK/.test(csv), 'no raw = formula cell survives')
    assert.ok(!/(^|,)@SUM/.test(csv), 'no raw @ formula cell survives')
  })

  it('keeps negative numeric columns intact (not treated as formulas)', () => {
    // Avoids Array.prototype.at: the project targets ES2020.
    const lines = buildPayrollCsv(exportData()).split('\n')
    const dataLine = lines[lines.length - 1] ?? ''

    assert.ok(dataLine.includes('-1.50'), 'negative flex hours preserved')
    assert.ok(!dataLine.includes(`'-1.50`), 'negative number not neutralized')
  })

  it('marks the downloaded CSV as UTF-8 so Excel keeps umlauts intact', () => {
    const csv = buildPayrollCsv(exportData({ employeeName: 'Anna Müller' }))

    // The generated CSV text stays clean; the BOM belongs to the file, not the
    // content, so non-file consumers are unaffected.
    assert.ok(!csv.startsWith('﻿'), 'buildPayrollCsv must not embed a BOM')

    const file = withUtf8Bom(csv)

    assert.ok(file.startsWith('﻿'), 'downloaded CSV must start with a BOM')
    assert.ok(file.includes('Anna Müller'), 'umlauts survive unchanged')
    // Applying it twice must not corrupt the file with a doubled BOM.
    assert.equal(withUtf8Bom(file), file)
  })

  it('escapes user-controlled values in the PDF export HTML', () => {
    const html = buildTimesheetPdfHtml(
      exportData({
        employeeName: '<script>alert(1)</script>',
        rows: [
          {
            breakHours: 0,
            date: '2026-05-04',
            flexHours: 0,
            paidHours: 8,
            status: '<img src=x onerror=alert(2)>',
            targetHours: 8,
            workedHours: 8,
          },
        ],
      })
    )

    assert.ok(!html.includes('<script>alert(1)</script>'), 'no raw script tag')
    assert.ok(!html.includes('<img src=x onerror=alert(2)>'), 'no raw img tag')
    assert.ok(html.includes('&lt;script&gt;'), 'name is HTML-escaped')
    assert.ok(html.includes('&lt;img src=x'), 'status is HTML-escaped')
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildCsv,
  csvCell,
  csvEscape,
  htmlEscape,
  neutralizeCsvFormula,
  withUtf8Bom,
} from './csv'

describe('csv primitives', () => {
  describe('neutralizeCsvFormula', () => {
    it('neutralizes every spreadsheet formula trigger', () => {
      assert.equal(neutralizeCsvFormula('=SUM(A1)'), `'=SUM(A1)`)
      assert.equal(neutralizeCsvFormula('+1+1'), `'+1+1`)
      assert.equal(neutralizeCsvFormula('@SUM(A1:A9)'), `'@SUM(A1:A9)`)
      assert.equal(neutralizeCsvFormula('\tfoo'), `'\tfoo`)
      assert.equal(neutralizeCsvFormula('\rfoo'), `'\rfoo`)
    })

    it('neutralizes a leading minus that is not a plain number', () => {
      // `-1+1` is evaluated by Excel even though it starts like a number.
      assert.equal(neutralizeCsvFormula('-1+1'), `'-1+1`)
      assert.equal(neutralizeCsvFormula('-HYPERLINK("x")'), `'-HYPERLINK("x")`)
    })

    it('keeps pre-formatted negative numbers intact', () => {
      // Payroll columns arrive as toFixed(2) strings; quoting them into text
      // would break every downstream sum in the payroll spreadsheet.
      assert.equal(neutralizeCsvFormula('-1.50'), '-1.50')
      assert.equal(neutralizeCsvFormula('-42'), '-42')
      assert.equal(neutralizeCsvFormula('0.00'), '0.00')
    })

    it('leaves ordinary text untouched', () => {
      assert.equal(neutralizeCsvFormula('Anna Müller'), 'Anna Müller')
      assert.equal(neutralizeCsvFormula(''), '')
    })
  })

  describe('csvEscape', () => {
    it('quotes separators, quotes, and newlines', () => {
      assert.equal(csvEscape('a,b'), '"a,b"')
      assert.equal(csvEscape('say "hi"'), '"say ""hi"""')
      assert.equal(csvEscape('line1\nline2'), '"line1\nline2"')
      assert.equal(csvEscape('line1\r\nline2'), '"line1\r\nline2"')
    })

    it('renders nullish cells as empty', () => {
      assert.equal(csvEscape(null), '')
      assert.equal(csvEscape(undefined), '')
    })

    it('passes plain values through unquoted', () => {
      assert.equal(csvEscape('plain'), 'plain')
      assert.equal(csvEscape(42), '42')
      assert.equal(csvEscape(true), 'true')
    })
  })

  describe('csvCell', () => {
    it('neutralizes before quoting so the apostrophe lands inside the quotes', () => {
      assert.equal(
        csvCell('=HYPERLINK("http://evil","x")'),
        `"'=HYPERLINK(""http://evil"",""x"")"`
      )
    })
  })

  describe('buildCsv', () => {
    it('joins rows and protects every cell', () => {
      const csv = buildCsv([
        ['Employee', 'Note', 'Flex'],
        ['=cmd|calc', 'a,b', '-1.50'],
      ])

      assert.equal(csv, `Employee,Note,Flex\n'=cmd|calc,"a,b",-1.50`)
    })

    it('does not embed a BOM in the content', () => {
      assert.ok(!buildCsv([['a']]).startsWith('﻿'))
    })
  })

  describe('withUtf8Bom', () => {
    it('adds a BOM once and only once', () => {
      const file = withUtf8Bom('Anna Müller')

      assert.ok(file.startsWith('﻿'))
      assert.ok(file.includes('Anna Müller'))
      assert.equal(withUtf8Bom(file), file)
    })
  })

  describe('htmlEscape', () => {
    it('escapes markup and quote characters', () => {
      assert.equal(
        htmlEscape('<script>alert("1")</script>'),
        '&lt;script&gt;alert(&quot;1&quot;)&lt;/script&gt;'
      )
      assert.equal(htmlEscape("it's"), 'it&#39;s')
    })

    it('renders nullish values as empty', () => {
      assert.equal(htmlEscape(null), '')
      assert.equal(htmlEscape(undefined), '')
    })
  })
})

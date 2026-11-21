// The on-device screenshot reader's parser: text in, transactions out. Text samples are written the way
// Tesseract returns them from phone screenshots, including its usual slips (O for 0, l for 1, stray bars).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseScreenshot, findAmounts, findDate, detectType, describe, fixDigits } from '../src/lib/ocrParse.js'
import { normalizeExtraction } from '../src/lib/extract.js'

const today = '2026-11-21'

test('amounts: signs, commas, parentheses, cents required, OCR slips', () => {
  assert.deepEqual(findAmounts('-$40.00').map((a) => [a.cents, a.sign]), [[4000, -1]])
  assert.deepEqual(findAmounts('+ $1,685.40').map((a) => [a.cents, a.sign]), [[168540, 1]])
  assert.deepEqual(findAmounts('($9.41)').map((a) => [a.cents, a.sign]), [[941, -1]])
  assert.deepEqual(findAmounts('$9.4l').map((a) => a.cents), [941])
  assert.deepEqual(findAmounts('Store #1182 Nov 20 2026 806-555-0199'), [])
  assert.deepEqual(findAmounts('12.50 CR').map((a) => a.sign), [1])
})

test('a lost decimal point ("-$4512") is read as cents and flagged for review', () => {
  assert.deepEqual(findAmounts('SHELL OIL 57442 -$4512').map((a) => [a.cents, a.sign, a.guessed]), [[4512, -1, true]])
  assert.deepEqual(findAmounts('Store #1182'), []) // no $: never guessed
  assert.equal(findAmounts('-$45.12 $4512')[0].cents, 4512) // a real decimal on the line wins
  const r = parseScreenshot(['MON, NOV 16', 'SHELL OIL 57442 -$4512'], { today })
  assert.deepEqual(r.transactions.map((t) => [t.amount, t.confidence]), [[45.12, 'low']])
})

test('dates: formats, headings, missing years never land in the future', () => {
  assert.equal(findDate('11/20/2026', today), '2026-11-20')
  assert.equal(findDate('11/20/26', today), '2026-11-20')
  assert.equal(findDate('Thursday, Nov 20', today), '2026-11-20')
  assert.equal(findDate('Dec 28', today), '2025-12-28')
  assert.equal(findDate('2026-10-17', today), '2026-10-17')
  assert.equal(findDate('20 Nov 2026', today), '2026-11-20')
  assert.equal(findDate('Today', today), today)
  assert.equal(findDate('Yesterday', today), '2026-11-20')
  assert.equal(findDate('No date here', today), null)
  assert.equal(findDate('13/45/2026', today), null)
})

test('bank app list: one row per transaction, headings give dates, signs give in/out, balances skipped', () => {
  const lines = [
    'Checking ••••4242', 'Available balance $1,204.33',
    'Today',
    'SONIC DRIVE IN #12 -$9.41', 'Pending',
    'NETFLIX.COM -$15.49',
    'Yesterday',
    'PAYROLL DIRECT DEP +$1,685.40',
    'Nov 18',
    'Zelle to Mom', '-$40.00',
    'WALMART SUPERCENTER | -$64.2O',
  ]
  const r = parseScreenshot(lines, { today })
  assert.equal(r.document_type, 'bank_list')
  assert.deepEqual(r.transactions.map((t) => [t.merchant, t.amount, t.type, t.date]), [
    ['SONIC DRIVE IN #12', 9.41, 'expense', '2026-11-21'],
    ['NETFLIX.COM', 15.49, 'expense', '2026-11-21'],
    ['PAYROLL DIRECT DEP', 1685.4, 'income', '2026-11-20'],
    ['Zelle to Mom', 40, 'expense', '2026-11-18'],
    ['WALMART SUPERCENTER', 64.2, 'expense', '2026-11-18'],
  ])
  assert.equal(r.masked_numbers, false)
})

test('bank statement rows: date, description, amount, running balance (balance ignored)', () => {
  const r = parseScreenshot(['11/03 SHELL OIL 57442 45.12 1,158.88', '11/04 DEPOSIT MOBILE 300.00 1,458.88', '11/05 OVERDRAFT FEE 35.00 1,423.88'], { today })
  assert.deepEqual(r.transactions.map((t) => [t.date, t.merchant, t.amount, t.type]), [
    ['2026-11-03', 'SHELL OIL 57442', 45.12, 'expense'],
    ['2026-11-04', 'DEPOSIT MOBILE', 300, 'income'],
    ['2026-11-05', 'OVERDRAFT FEE', 35, 'expense'],
  ])
})

test('pay stub: one income row for NET pay (this period, not YTD), on the pay date', () => {
  const lines = ['ACME MILLING CO', 'Pay Period: 11/02/2026 - 11/15/2026', 'Pay Date: 11/20/2026',
    'Gross Pay 2,240.00 41,880.00', 'Federal Income Tax 182.10', 'Social Security 138.88', 'Medicare 32.48',
    'Net Pay 1,685.40 31,204.12', 'Direct Deposit ****4242']
  const r = parseScreenshot(lines, { today })
  assert.equal(r.document_type, 'pay_stub')
  assert.deepEqual(r.transactions.map((t) => [t.merchant, t.amount, t.type, t.date, t.category_hint]), [['Paycheck', 1685.4, 'income', '2026-11-20', 'paycheck']])
  assert.equal(r.masked_numbers, false) // ****4242 is already masked
})

test('receipt: one row for the total (not subtotal or card line), merchant from the top', () => {
  const lines = ['ALLSUP\'S #214', '123 Main St', 'Hereford TX 79045', '11/19/2026 07:42 AM',
    'COFFEE LG 2.49', 'BURRITO 3.99', 'SUBTOTAL 6.48', 'TAX 0.54', 'TOTAL 7.O2', 'VISA ****1111 7.02', 'THANK YOU']
  const r = parseScreenshot(lines, { today })
  assert.equal(r.document_type, 'receipt')
  assert.deepEqual(r.transactions.map((t) => [t.merchant, t.amount, t.type, t.date]), [["ALLSUP'S #214", 7.02, 'expense', '2026-11-19']])
})

test('low reader confidence and missing dates are flagged for review', () => {
  const r = parseScreenshot([{ text: 'CORNER STORE -$3.50', conf: 52 }], { today })
  assert.equal(r.transactions[0].confidence, 'low')
  const n = normalizeExtraction(r)
  assert.equal(n.rows[0].dateGuessed, true)
})

test('numbers that look like full card or account numbers are masked before review', () => {
  const r = parseScreenshot(['Transfer to 4111111111111111 -$40.00'], { today })
  assert.equal(r.masked_numbers, true)
  const n = normalizeExtraction(r)
  assert.ok(!/4111111111111111/.test(n.rows[0].description))
  assert.equal(n.rows[0].hadNumber, true)
})

test('junk in, nothing out (never throws)', () => {
  for (const x of [null, [], ['', '   '], ['Hello there'], ['$$$$', '-.--'], [{ text: null }]]) {
    assert.deepEqual(parseScreenshot(x, { today }).transactions, [])
  }
  assert.equal(detectType(['Hello']), 'other')
})

test('helpers', () => {
  assert.equal(describe('• STARBUCKS #2210 Nov 20 -$6.45 Pending'), 'STARBUCKS #2210')
  assert.equal(fixDigits('$1O.5l'), '$10.51')
  assert.equal(fixDigits('SONIC'), 'SONIC')
})

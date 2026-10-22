import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maskSensitive, cleanText } from '../src/lib/privacy.js'
import { parseAmount, formatMoney } from '../src/lib/money.js'
import { parseDate, addMonths } from '../src/lib/dates.js'
import { categorize, merchantKey } from '../src/lib/categorize.js'
import { findLeaks } from '../src/lib/leaks.js'
import { goalPlan } from '../src/lib/goals.js'
import { futureValue } from '../src/lib/invest.js'
import { parseBankCsv, toCsv } from '../src/lib/csv.js'
import { sanitizeTxn } from '../src/lib/sanitize.js'
import { cleanBackup, encryptBackup, decryptBackup, buildBackup } from '../src/lib/backup.js'
import { suggestions } from '../src/lib/insights.js'

test('masks card, account, routing numbers and SSNs', () => {
  assert.equal(maskSensitive('Card 4111 1111 1111 1234'), 'Card ••••1234')
  assert.equal(maskSensitive('acct 000123456789'), 'acct ••••6789')
  assert.equal(maskSensitive('Routing 111000025'), 'Routing ••••0025')
  assert.equal(maskSensitive('SSN 123-45-6789'), 'SSN [removed]')
  assert.equal(maskSensitive('XXXXXXXX5678 debit'), '••••5678 debit')
  assert.equal(maskSensitive('acct no. 123456'), 'acct no. ••••3456')
  assert.equal(maskSensitive('4111-1111-1111-9999'), '••••9999')
  // leaves normal text, dates and prices alone
  assert.equal(maskSensitive('SONIC #4421 2026-10-22 $12.50'), 'SONIC #4421 2026-10-22 $12.50')
  assert.equal(maskSensitive('Walmart 10/22/2026'), 'Walmart 10/22/2026')
  assert.equal(maskSensitive('MAXX 12'), 'MAXX 12')
  // idempotent
  assert.equal(maskSensitive(maskSensitive('Card 4111111111111234')), 'Card ••••1234')
  assert.equal(cleanText('a\u0000b‮c  d'), 'a b c d')
})

test('parses amounts', () => {
  assert.equal(parseAmount('$1,234.56'), 123456)
  assert.equal(parseAmount('(45.10)'), -4510)
  assert.equal(parseAmount('-12'), -1200)
  assert.equal(parseAmount('12.00-'), -1200)
  assert.equal(parseAmount('abc'), null)
  assert.equal(parseAmount('1.234,56'), 123456)
  assert.equal(formatMoney(123456), '$1,234.56')
})

test('parses dates', () => {
  assert.equal(parseDate('10/22/2026'), '2026-10-22')
  assert.equal(parseDate('2026-10-22'), '2026-10-22')
  assert.equal(parseDate('Oct 22, 2026'), '2026-10-22')
  assert.equal(parseDate('2/30/2026'), null)
  assert.equal(addMonths('2026-01', -1), '2025-12')
})

test('categorizes common merchants', () => {
  const c = (d, a = 1000, type = 'expense') => categorize({ description: d, amount: a, type })
  assert.equal(c('SQ *SONIC DRIVE IN #4421 HEREFORD TX'), 'eating_out')
  assert.equal(c("ALLSUP'S #123", 650), 'convenience')
  assert.equal(c("ALLSUP'S #123", 6500), 'gas')
  assert.equal(c('NETFLIX.COM'), 'subscriptions')
  assert.equal(c('OVERDRAFT FEE'), 'fees')
  assert.equal(c('ATM FEE CIRCLE K'), 'fees')
  assert.equal(c('UNITED SUPERMARKETS'), 'groceries')
  assert.equal(c('JLL PAYROLL DIR DEP', 150000, 'income'), 'paycheck')
  assert.equal(c('RANDOM THING'), 'other')
  // user correction wins
  assert.equal(categorize({ description: 'RANDOM THING 22', amount: 100, type: 'expense' }, { 'random thing': 'gifts' }), 'gifts')
  assert.equal(merchantKey('SQ *SONIC DRIVE IN #4421 HEREFORD TX'), 'sonic drive in')
})

const T = (date, description, dollars, type = 'expense', extra = {}) => {
  const amount = Math.round(dollars * 100)
  return { date, description, amount, type, category: categorize({ description, amount, type }), ...extra }
}

test('finds leaks', () => {
  const txns = [
    T('2026-08-03', 'NETFLIX.COM', 15.49), T('2026-09-03', 'NETFLIX.COM', 15.49), T('2026-10-03', 'NETFLIX.COM', 15.49),
    T('2026-09-05', 'SPOTIFY', 11.99), T('2026-10-05', 'SPOTIFY', 11.99),
    T('2026-10-01', 'SONIC', 9), T('2026-10-04', 'MCDONALDS', 11), T('2026-10-08', 'WHATABURGER', 14), T('2026-10-12', 'SONIC', 8),
    T('2026-10-10', 'OVERDRAFT FEE', 35), T('2026-10-11', 'ATM FEE', 3.5),
    T('2026-09-10', 'AMAZON', 40), T('2026-10-10', 'AMAZON', 160),
    T('2026-10-15', 'GYM MEMBERSHIP', 25), T('2026-10-16', 'GYM MEMBERSHIP', 25),
    T('2026-10-01', 'PAYROLL', 2000, 'income'),
    T('2026-09-01', 'RENT', 900), T('2026-10-01', 'RENT', 900),
    T('2026-09-12', 'GM FINANCIAL', 488), T('2026-10-12', 'GM FINANCIAL', 488),
  ]
  const leaks = findLeaks(txns, '2026-10')
  const kinds = leaks.map((l) => l.kind)
  assert.ok(kinds.includes('subscriptions'))
  assert.ok(kinds.includes('fees'))
  assert.ok(kinds.includes('small'))
  assert.ok(kinds.includes('jump'))
  assert.ok(kinds.includes('duplicate'))
  const fees = leaks.find((l) => l.kind === 'fees')
  assert.equal(fees.monthly, 3850)
  assert.equal(fees.yearly, 3850 * 12)
  const sub = leaks.find((l) => l.kind === 'subscriptions')
  assert.ok(sub.items.some((i) => i.label === 'Netflix'))
  assert.ok(!sub.items.some((i) => /Rent|Gm Financial/.test(i.label)), 'bills are not leaks')
  const s = suggestions({ txns, month: '2026-10', leaks, goals: [{ name: 'Emergency fund', target: 500000, saved: 0 }], leftover: 50000 })
  assert.ok(s.length > 0)
})

test('goal math', () => {
  const p = goalPlan({ target: 520000, saved: 0, targetDate: '2027-10-22' }, { leftover: 20000, plugged: 10000, today: '2026-10-22' })
  assert.ok(Math.abs(p.perWeek - 9973) < 5)
  assert.ok(Math.abs(p.perMonth - 43334) < 100)
  assert.equal(p.monthsAtCurrent, 26)
  assert.ok(Math.abs(p.monthsWithPlugs - 17.33) < 0.01)
  assert.equal(goalPlan({ target: 100, saved: 0 }, { leftover: -5 }).monthsAtCurrent, null)
})

test('invest math', () => {
  // $100/month for 10 years at 7% ≈ $17,308
  assert.ok(Math.abs(futureValue(10000, 0.07, 10) / 100 - 17308.48) < 1)
  assert.equal(futureValue(10000, 0, 1), 120000)
})

test('parses bank CSVs', () => {
  const a = parseBankCsv('Date,Description,Amount,Account Number\n10/01/2026,PAYROLL,1500.00,123456789\n10/02/2026,SONIC 4111111111111111,-8.50,123456789\nbad,row,1,1\n')
  assert.equal(a.rows.length, 2)
  assert.equal(a.skipped, 1)
  assert.equal(a.rows[1].description, 'SONIC ••••1111')
  assert.equal(a.rows[1].type, 'expense')
  assert.ok(!JSON.stringify(a.rows).includes('123456789'))
  const b = parseBankCsv('Posted Date,Payee,Debit,Credit\n2026-10-01,Rent,800,\n2026-10-02,Deposit,,1200\n')
  assert.deepEqual(b.rows.map((r) => r.type), ['expense', 'income'])
  const c = parseBankCsv('Date,Description,Amount,Type\n10/01/2026,Walmart,25.00,Debit\n10/02/2026,Refund,5.00,Credit\n')
  assert.deepEqual(c.rows.map((r) => r.type), ['expense', 'income'])
  assert.throws(() => parseBankCsv('foo,bar\n1,2\n'))
  assert.ok(toCsv([{ date: '2026-10-01', description: '=HYPERLINK("x")', category: 'other', type: 'expense', amount: 100 }]).includes("'=HYPERLINK"))
})

test('sanitizes untrusted transactions', () => {
  assert.equal(sanitizeTxn({ date: '2026-13-01', description: 'x', amount: 1, type: 'expense' }), null)
  assert.equal(sanitizeTxn({ date: '2026-10-01', description: 'x', amount: 1.5, type: 'expense' }), null)
  assert.equal(sanitizeTxn({ date: '2026-10-01', description: 'x', amount: 100, type: 'hack' }), null)
  const t = sanitizeTxn({ date: '2026-10-01', description: '<img src=x onerror=alert(1)> 4111111111111111', amount: 100, type: 'expense', category: 'paycheck', id: 5, extra: 'x' })
  assert.equal(t.category, 'other')
  assert.ok(t.description.includes('••••1111'))
  assert.equal(t.extra, undefined)
})

test('backup round trip, encrypted, and hostile input', async () => {
  const data = buildBackup({ transactions: [T('2026-10-01', 'SONIC', 9)], goals: [{ name: 'Truck', target: 100000, saved: 0 }], merchantRules: { sonic: 'eating_out', 'bad key!': 'x' }, settings: { hourlyWage: 2000 } })
  const clean = cleanBackup(JSON.parse(JSON.stringify(data)))
  assert.equal(clean.transactions.length, 1)
  assert.deepEqual(clean.merchantRules, { sonic: 'eating_out' })
  const locked = await encryptBackup(data, 'correct horse')
  assert.ok(!JSON.stringify(locked).includes('SONIC'))
  const back = await decryptBackup(locked, 'correct horse')
  assert.equal(back.transactions[0].description, 'SONIC')
  await assert.rejects(() => decryptBackup(locked, 'wrong'))
  assert.throws(() => cleanBackup({ app: 'other' }))
  const hostile = cleanBackup({ app: 'money-leak-finder', transactions: [{ date: '2026-10-01', description: 'x', amount: 1e15, type: 'expense' }, null, 'str'], goals: [{ target: -5 }], settings: { hourlyWage: 'x', __proto__: { polluted: 1 } } })
  assert.equal(hostile.transactions.length, 0)
  assert.equal(hostile.goals.length, 0)
  assert.equal({}.polluted, undefined)
})

test('predicts upcoming recurring charges', async () => {
  const { upcomingCharges } = await import('../src/lib/leaks.js')
  const txns = [T('2026-08-25', 'NETFLIX.COM', 15.49), T('2026-09-25', 'NETFLIX.COM', 15.49), T('2026-09-01', 'RENT', 900), T('2026-10-01', 'RENT', 900)]
  const up = upcomingCharges(txns, '2026-10-22')
  assert.equal(up.length, 2)
  assert.equal(up[0].name, 'Netflix')
  assert.equal(up[1].next, '2026-11-01')
  assert.equal(up[0].next, '2026-10-25')
  assert.equal(up[0].inDays, 3)
})

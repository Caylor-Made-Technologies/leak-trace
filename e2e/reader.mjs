// The on-device screenshot reader, end to end in a real browser: each test screenshot goes through
// Add -> Read screenshots -> review, and the rows are scored against the answer key.
// Also checks: no request leaves the app, reader files load from the app itself, works offline after first use.
//   npm run build && npx vite preview --port 4173 &   then   BASE_URL=http://localhost:4173/ node e2e/reader.mjs
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright')
const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const DIR = new URL('../tests/fixtures/screens/', import.meta.url).pathname
const key = JSON.parse(readFileSync(DIR + 'answers.json', 'utf8'))
let failures = 0
const check = (ok, name) => { console.log(`${ok ? '✓' : '✗'} ${name}`); if (!ok) failures++ }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
// Pin "today" to the answer key's date so "Today" / "Yesterday" headings are checkable.
await ctx.addInitScript((today) => {
  const fixed = new Date(today + 'T12:00:00').getTime()
  const RealDate = Date
  globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [fixed])) } static now() { return fixed } }
}, key.today)
const page = await ctx.newPage()
const outside = new Set(), errors = []
page.on('request', (r) => { const u = new URL(r.url()); if (u.origin !== new URL(BASE).origin && !u.protocol.startsWith('blob') && !u.protocol.startsWith('data')) outside.add(u.origin) })
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))

async function readOne(file) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Add money in or out' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /Read screenshots/ }).click()
  await page.setInputFiles('#shots', DIR + file)
  const t0 = Date.now()
  await page.getByRole('dialog').getByRole('button', { name: /^Read 1 screenshot/ }).click()
  await page.getByText(/Found \d+ items?|No transactions found/).waitFor({ timeout: 120000 })
  const secs = (Date.now() - t0) / 1000
  const rows = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] li')].filter((li) => li.querySelector('input[aria-label="Amount"]')).map((li) => ({
    merchant: li.querySelector('input[aria-label="Description"]').value,
    amount: Number(li.querySelector('input[aria-label="Amount"]').value),
    date: li.querySelector('input[aria-label="Date"]').value,
    type: /In/.test(li.querySelector('button[aria-label^="Type"]').textContent) ? 'income' : 'expense',
  })))
  return { rows, secs }
}

let expected = 0, exact = 0, amountsRight = 0, extra = 0
for (const [name, answers] of Object.entries(key.answers)) {
  const { rows, secs } = await readOne(name.includes('compressed') ? `${name}.jpg` : `${name}.png`)
  const left = [...rows]
  let ok = 0, amt = 0
  for (const [m, amount, type, date] of answers) {
    const i = left.findIndex((r) => Math.abs(r.amount - amount) < 0.005 && r.type === type)
    if (i < 0) { console.log(`    ${name}: missed ${JSON.stringify([m, amount, type, date])}`); continue }
    amt++
    const r = left.splice(i, 1)[0]
    if (r.date === date && r.merchant.toLowerCase().includes(m.toLowerCase())) ok++
    else console.log(`    ${name}: ${JSON.stringify(r)} vs ${JSON.stringify([m, amount, type, date])}`)
  }
  expected += answers.length; exact += ok; amountsRight += amt; extra += left.length
  if (left.length) console.log(`    ${name}: extra rows ${JSON.stringify(left)}`)
  console.log(`  ${name}: ${ok}/${answers.length} exact, ${amt}/${answers.length} amounts, ${left.length} extra, ${secs.toFixed(1)} s`)
  await page.screenshot({ path: `${process.env.SHOTS || '/tmp'}/reader-${name}.png` })
}
const pct = (n) => Math.round((n / expected) * 100)
console.log(`  TOTAL: ${exact}/${expected} exact (${pct(exact)}%), amounts+type ${amountsRight}/${expected} (${pct(amountsRight)}%), ${extra} extra rows`)
check(amountsRight / expected >= 0.9, `amounts and in/out right on at least 90% of rows (${pct(amountsRight)}%)`)
check(exact / expected >= 0.8, `whole row right (merchant, amount, date, in/out) on at least 80% (${pct(exact)}%)`)
check(extra <= 1, `no more than 1 made-up row (${extra})`)
check(outside.size === 0, `nothing sent outside the app ${[...outside].join(', ')}`)

// Offline after first use: the reader comes from the cache.
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await ctx.setOffline(true)
const { rows } = await readOne('receipt.png').catch((e) => ({ rows: [], err: e }))
check(rows.some((r) => Math.abs(r.amount - 7.02) < 0.005), 'reads a screenshot offline after first use')
await ctx.setOffline(false)

check(errors.filter((e) => !/Failed to load resource/.test(e)).length === 0, `no console errors ${errors.slice(0, 3).join(' | ')}`)
await browser.close()
console.log(failures ? `\n${failures} FAILED` : '\nAll reader checks passed')
process.exit(failures ? 1 : 0)

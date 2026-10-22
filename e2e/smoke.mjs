// End-to-end check at iPhone size. Usage:
//   npm run build && npx vite preview --port 4173 &
//   BASE_URL=http://localhost:4173/ AXE_PATH=/path/to/axe.min.js node e2e/smoke.mjs
// Uses the Playwright install at PLAYWRIGHT_PATH (default: the global one).
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium, devices } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright')

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const SHOTS = process.env.SHOTS || 'test-results'
const AXE = process.env.AXE_PATH ? readFileSync(process.env.AXE_PATH, 'utf8') : null
const LIVE = !!process.env.LIVE
mkdirSync(SHOTS, { recursive: true })

let failures = 0
const check = (ok, name) => { console.log(`${ok ? '✓' : '✗'} ${name}`); if (!ok) failures++ }

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], acceptDownloads: true, colorScheme: process.env.COLOR === 'dark' ? 'dark' : 'light' })
const page = await ctx.newPage()
const errors = []
const outside = new Set()
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(e.message))
page.on('request', (r) => { const u = new URL(r.url()); if (u.origin !== new URL(BASE).origin && !u.pathname.endsWith('/extract')) outside.add(u.origin) })

// Fake reader so the screenshot flow can be tested without an API key.
await page.route('**/extract', (route) => route.fulfill({
  status: 200,
  headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  body: JSON.stringify({ document_type: 'bank_list', masked_numbers: true, transactions: [
    { date: '2026-10-20', merchant: 'Transfer to 4111111111111111', amount: 40, type: 'expense', category_hint: 'transfer', confidence: 'high' },
    { date: '', merchant: 'Sonic', amount: 9.41, type: 'expense', category_hint: 'eating_out', confidence: 'low' },
    { date: '2026-10-17', merchant: 'Paycheck', amount: 1685.4, type: 'income', category_hint: 'paycheck', confidence: 'high' },
  ] }),
}))

async function axe(label) {
  if (!AXE) return
  await page.evaluate(AXE)
  const res = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target} ${v.id === 'color-contrast' ? v.nodes.map((n) => n.any[0]?.message).join(' / ') : ''}`))
  check(res.length === 0, `axe clean: ${label}${res.length ? ' → ' + res.join(' | ') : ''}`)
}
const tab = (name) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: new RegExp(`^${name}`) }).click()
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` })

await page.goto(BASE)
await page.getByText('Find where your money slips away').waitFor()
check(true, 'empty state shows')
await axe('empty home')
await shot('01-empty')

if (!LIVE) {
  // Sample data → dashboard
  await page.getByRole('button', { name: /sample data/i }).click()
  await page.getByText('Left over this month').waitFor()
  await page.waitForTimeout(1200)
  check(await page.getByText(/leaks? found/).isVisible(), 'leak banner shows')
  check(await page.getByText('Your money story').isVisible(), 'money story shows')
  await shot('02-home')
  await page.mouse.wheel(0, 900); await page.waitForTimeout(700); await shot('03-home-charts')
  await axe('home with data')

  // Leaks
  await tab('Leaks')
  await page.getByText(/per year/).first().waitFor()
  const leakText = await page.locator('main').innerText()
  check(/You spent \$[\d,]+ this month, about \$[\d,]+ per year/.test(leakText), 'leak sentence format')
  check(/recurring charge/i.test(leakText) && /fee/i.test(leakText) && /trips/.test(leakText), 'subscriptions, fees and small purchases found')
  await page.waitForTimeout(600); await shot('04-leaks')
  await axe('leaks')
  await page.getByRole('button', { name: /Plug it/ }).first().click()
  await page.getByText('Plugged 🔧').waitFor()
  check(true, 'plug a leak')

  // Goals
  await tab('Plan')
  await page.getByRole('button', { name: 'New goal' }).click()
  await page.getByRole('button', { name: /Emergency fund/ }).click()
  await page.getByRole('button', { name: 'Create goal' }).click()
  await page.getByText('Save per week').waitFor()
  const planText = await page.locator('main').innerText()
  check(/sooner/.test(planText) || /makes this possible/.test(planText), 'goal shows how much faster with plugs')
  await page.waitForTimeout(900); await shot('05-goal')
  await axe('goals')
  await page.getByRole('tab', { name: /Invest/ }).click()
  await page.getByText('What it could be worth').waitFor()
  check(/not financial advice/i.test(await page.locator('main').innerText()), 'invest disclaimer')
  await page.waitForTimeout(1200); await shot('06-invest')
  await axe('invest')
}

// Manual entry with a card number + XSS attempt
await page.getByRole('button', { name: 'Add money in or out' }).click()
await page.getByRole('button', { name: /Type it in/ }).click()
await page.locator('#amt').fill('12.34')
await page.locator('#desc').fill('<img src=x onerror="window.__pwned=1"> card 4111 1111 1111 4242')
await page.getByText(/looks like an account or card number/).waitFor()
await shot('07-manual')
await page.getByRole('button', { name: 'Add it' }).click()
await tab('Activity')
await page.waitForTimeout(500)
const act = await page.locator('main').innerText()
check(act.includes('••••4242') && !act.includes('4111 1111'), 'card number masked on save')
check(await page.evaluate(() => window.__pwned === undefined), 'typed HTML is not run')
await axe('activity')

// CSV upload
await page.getByRole('button', { name: 'Add money in or out' }).click()
await page.getByRole('button', { name: /bank CSV/i }).click()
await page.locator('#csvfile').setInputFiles({ name: 'bank.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Description,Amount,Account Number\n10/01/2026,PAYROLL DIR DEP,1500.00,000123456789\n10/02/2026,NETFLIX.COM,-15.49,000123456789\n10/03/2026,=CMD|calc,-1.00,000123456789\n') })
await page.getByText(/Import 3 transactions/).waitFor()
await shot('08-csv')
await page.getByRole('button', { name: /Import 3 transactions/ }).click()
await page.getByText(/Imported/).waitFor()
check(true, 'CSV import')
const all = await page.evaluate(async () => {
  const req = indexedDB.open('money-leak-finder')
  const db = await new Promise((r) => { req.onsuccess = () => r(req.result) })
  return new Promise((r) => { const q = db.transaction('transactions').objectStore('transactions').getAll(); q.onsuccess = () => r(JSON.stringify(q.result)) })
})
check(!all.includes('000123456789') && !all.includes('4111'), 'no full account/card numbers stored anywhere')

// Screenshot reading (mocked reader)
await page.getByRole('button', { name: 'Add money in or out' }).click()
await page.getByRole('button', { name: /Read screenshots/ }).click()
const png = readFileSync(new URL('../public/icons/icon-192.png', import.meta.url))
await page.locator('#shots').setInputFiles([{ name: 'stub.png', mimeType: 'image/png', buffer: png }])
await page.getByRole('button', { name: /Read 1 screenshot/ }).click()
await page.getByText(/Found 3 items/).waitFor()
check((await page.locator('img[src^="blob:"]').count()) === 0, 'screenshots removed from screen after reading')
check(await page.getByText('Account or card numbers were hidden').isVisible(), 'masking notice shown')
check(await page.locator('input[aria-label="Description"]').first().inputValue() === 'Transfer to ••••1111', 'reader output masked again in the app')
await shot('09-review')
await axe('screenshot review')
await page.getByRole('button', { name: /^Save 3/ }).click()
await page.getByText(/Screenshots deleted/).waitFor()
check(true, 'screenshot rows saved')

// Settings: encrypted backup + restore
await page.getByRole('button', { name: 'Settings and privacy' }).click()
await page.locator('#bpw').fill('correct horse battery')
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Save backup file/ }).click()])
const backupPath = `${SHOTS}/backup.json`
await dl.saveAs(backupPath)
const backup = readFileSync(backupPath, 'utf8')
check(backup.includes('"encrypted":true') && !backup.includes('PAYROLL'), 'backup is encrypted')
await shot('10-settings')
await axe('settings')
await page.locator('#restore').setInputFiles(backupPath)
await page.locator('#upw').fill('wrong password')
await page.getByRole('button', { name: 'Unlock' }).click()
await page.getByText(/Wrong password/).waitFor()
await page.locator('#upw').fill('correct horse battery')
await page.getByRole('button', { name: 'Unlock' }).click()
await page.getByText(/Found \d+ transactions/).waitFor()
check(true, 'locked backup opens only with the right password')
// hostile backup file
const evil = `${SHOTS}/evil.json`
writeFileSync(evil, JSON.stringify({ app: 'money-leak-finder', transactions: [{ date: '2026-10-01', description: '<script>alert(1)</script>', amount: 5, type: 'expense', category: '__proto__' }, { date: 'x', amount: 'y' }], goals: [{ name: 'x', target: -1 }] }))
await page.locator('#restore').setInputFiles(evil)
await page.getByText(/Found 1 transactions and 0 goals/).waitFor()
check(true, 'hostile backup cleaned (bad rows dropped)')

// Light mode
await page.getByRole('tab', { name: /Light/ }).click()
await page.getByRole('button', { name: 'Close' }).first().click()
await tab('Home')
await page.waitForTimeout(900)
await shot('11-light')
await axe('home light')
await tab('Leaks'); await page.waitForTimeout(600); await axe('leaks light')

// Privacy blur
await page.getByRole('button', { name: 'Hide amounts' }).click()
check(await page.evaluate(() => document.documentElement.classList.contains('privacy')), 'hide amounts toggle')
await page.getByRole('button', { name: 'Show amounts' }).click()

// Offline reload
await page.waitForTimeout(1500)
await ctx.setOffline(true)
await page.reload()
await page.getByText('Money Leak Finder').first().waitFor()
check(true, 'works offline after first visit')
await ctx.setOffline(false)

// Delete all
await page.getByRole('button', { name: 'Settings and privacy' }).click()
await page.getByRole('button', { name: 'Delete all my data' }).click()
await page.locator('#confirmDel').fill('DELETE')
await page.getByRole('button', { name: 'Erase everything' }).click()
await page.getByText('Find where your money slips away').waitFor()
check(true, 'delete all data')

const horiz = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
check(!horiz, 'no sideways scrolling')
const cspErrors = errors.filter((e) => /Content Security Policy|Refused/.test(e))
check(cspErrors.length === 0, `no CSP violations ${cspErrors.join(' | ')}`)
const other = errors.filter((e) => !/Content Security Policy|Refused/.test(e))
check(other.length === 0, `no console errors ${other.slice(0, 5).join(' | ')}`)
check(outside.size === 0, `no requests to other sites ${[...outside].join(', ')}`)

await browser.close()
console.log(failures ? `\n${failures} FAILED` : '\nAll checks passed')
process.exit(failures ? 1 : 0)

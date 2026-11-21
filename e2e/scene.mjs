// The overhaul checks: v1 data upgraded in a real browser, the pipe scene in 3D and as a drawing,
// 3D budget and idle frames, 320 px, and the 390x844 screenshots in docs/screenshots/.
//   npm run build && npx vite preview --port 4173 &  then  BASE_URL=http://localhost:4173/ node e2e/scene.mjs
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright')
const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const OUT = new URL('../docs/screenshots/', import.meta.url).pathname
const fixture = JSON.parse(readFileSync(new URL('../tests/fixtures/v1-indexeddb.json', import.meta.url), 'utf8'))
let failures = 0
const check = (ok, name) => { console.log(`${ok ? '✓' : '✗'} ${name}`); if (!ok) failures++ }

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errors = []
async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...opts })
  const page = await ctx.newPage()
  // The reader's /health, faked as switched on (no outside calls from the test); section 4 overrides it.
  await page.route('**/health', (r) => r.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: '{"ok":true,"reader":true}' }))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  return { ctx, page }
}
const tab = (page, name) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: new RegExp(`^${name}`) }).click()

// 1. A v1 database (written by the old app) opens in the new app with nothing lost.
{
  const { ctx, page } = await newPage()
  await page.goto(BASE + 'icons/favicon.svg') // same origin, app not running yet
  await page.evaluate(async (fx) => {
    await new Promise((res, rej) => {
      const r = indexedDB.open('money-leak-finder', 10)
      r.onupgradeneeded = () => {
        const db = r.result
        db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true }).createIndex('date', 'date')
        db.createObjectStore('rules', { keyPath: 'merchant' })
        db.createObjectStore('goals', { keyPath: 'id', autoIncrement: true })
        db.createObjectStore('settings', { keyPath: 'key' })
      }
      r.onsuccess = () => {
        const db = r.result
        const tx = db.transaction(Object.keys(fx.tables), 'readwrite')
        for (const [name, rows] of Object.entries(fx.tables)) for (const row of rows) tx.objectStore(name).put(row)
        tx.oncomplete = () => { db.close(); res() }
        tx.onerror = rej
      }
      r.onerror = rej
    })
  }, fixture)
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByText('Left over this month').waitFor({ timeout: 15000 })
  const after = await page.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open('money-leak-finder'); q.onsuccess = () => r(q.result) })
    const count = (n) => new Promise((r) => { const q = db.transaction(n).objectStore(n).count(); q.onsuccess = () => r(q.result) })
    const out = { version: db.version, txns: await count('transactions'), goals: await count('goals'), rules: await count('rules'), settings: await count('settings') }
    out.meta = await new Promise((r) => { const q = db.transaction('meta').objectStore('meta').get('schema'); q.onsuccess = () => r(q.result) })
    db.close()
    return out
  })
  check(after.version === 20 && after.meta?.value === 2, `v1 database upgraded to v2 in the browser (idb ${after.version})`)
  check(after.txns === 130 && after.goals === 1 && after.rules === 1 && after.settings === 3, `every v1 record kept: ${JSON.stringify(after)}`)
  await ctx.close()
}

// 2. Screens + the pipe in 3D.
const { ctx, page } = await newPage()
await page.goto(BASE + '?3d=1&debug3d', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
check(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'dark by default')
await page.screenshot({ path: OUT + 'after-empty.png' })
await page.getByRole('button', { name: /sample data/i }).click()
await page.getByText('Left over this month').waitFor()
await page.waitForTimeout(1500)
await page.screenshot({ path: OUT + 'after-home.png' })
await tab(page, 'Leaks')
await page.waitForFunction(() => window.__scene3d, null, { timeout: 20000 })
await page.waitForTimeout(2200)
await page.screenshot({ path: OUT + 'after-leaks-3d.png' })
for (let i = 0, prev = -1; i < 40; i++) { const f = await page.evaluate(() => window.__scene3d.frames()); if (f === prev) break; prev = f; await page.waitForTimeout(500) }
const st = await page.evaluate(() => window.__scene3d.stats())
check(st.calls < 100 && st.triangles < 100000, `3D budget: ${st.calls} draw calls, ${st.triangles} triangles`)
const f0 = await page.evaluate(() => window.__scene3d.frames())
await page.waitForTimeout(1500)
check((await page.evaluate(() => window.__scene3d.frames())) === f0, 'idle scene draws 0 frames')
// Focus another leak from the list: the scene follows.
await page.getByRole('button', { name: /Show details/ }).nth(1).click()
await page.waitForTimeout(300)
check((await page.evaluate(() => window.__scene3d.frames())) > f0, 'tapping a leak redraws the scene toward it')
for (const n of ['Activity', 'Plan']) { await tab(page, n); await page.waitForTimeout(1200); await page.screenshot({ path: OUT + `after-${n.toLowerCase()}.png` }) }
await tab(page, 'Leaks')
await page.waitForTimeout(500)
check(!(await page.evaluate(() => !!window.__scene3d && document.querySelectorAll('.pipe-stage canvas').length > 1)), 'one canvas at a time')
await ctx.close()

// 3. Reduced motion: the drawing, no WebGL.
{
  const { ctx, page } = await newPage({ reducedMotion: 'reduce' })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /sample data/i }).click()
  await page.getByText('Left over this month').waitFor()
  await tab(page, 'Leaks')
  await page.waitForTimeout(1200)
  const mode = await page.evaluate(() => document.querySelector('.pipe-stage')?.dataset.mode)
  check(/^2d:/.test(mode) && !(await page.$('.pipe-stage canvas')), `reduced motion -> drawing (${mode})`)
  await page.screenshot({ path: OUT + 'after-leaks-2d.png' })
  await page.setViewportSize({ width: 320, height: 640 })
  for (const n of ['Home', 'Activity', 'Leaks', 'Plan']) {
    await tab(page, n); await page.waitForTimeout(500)
    const w = await page.evaluate(() => document.documentElement.scrollWidth)
    check(w <= 320, `320 px ${n}: width ${w}`)
  }
  await ctx.close()
}

// 4. Screenshot reader not switched on: lead with what works, show screenshots as "coming soon".
{
  const { ctx, page } = await newPage()
  await page.route('**/health', (r) => r.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: '{"ok":true,"reader":false}' }))
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByText('Find where your money slips away').waitFor()
  await page.waitForTimeout(600)
  check(!(await page.getByRole('button', { name: /Read screenshots/ }).count()) && await page.getByRole('button', { name: /Type it in/ }).first().isVisible(), 'reader off: home leads with Type it in, no Read screenshots button')
  await page.screenshot({ path: OUT + 'after-empty-reader-off.png' })
  await page.getByRole('button', { name: 'Add money in or out' }).click()
  const shotBtn = page.getByRole('dialog').getByRole('button', { name: /Read screenshots/ })
  check(await shotBtn.isDisabled() && /coming soon/i.test(await shotBtn.innerText()), 'reader off: add sheet shows screenshots as Coming soon (disabled)')
  await ctx.close()
}

check(errors.length === 0, `console errors: ${errors.slice(0, 4).join(' | ') || 'none'}`)
await browser.close()
console.log(failures ? `\n${failures} FAILED` : '\nAll scene checks passed')
process.exit(failures ? 1 : 0)

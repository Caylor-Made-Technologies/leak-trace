// Draws realistic test screenshots (made-up data, 390x844 @3x like an iPhone) for the reader tests:
// a bank app list in light and dark mode, a pay stub and a store receipt. Each has an answer key.
//   node e2e/make-screens.mjs   -> tests/fixtures/screens/*.png + answers.json
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright')
const OUT = new URL('../tests/fixtures/screens/', import.meta.url).pathname

const bankRows = [
  ['Today', [['SONIC DRIVE IN #12', '-$9.41'], ['NETFLIX.COM', '-$15.49']]],
  ['Yesterday', [['PAYROLL DIRECT DEP', '+$1,685.40'], ['WALMART SUPERCENTER', '-$64.20']]],
  ['Wed, Nov 18', [['ALLSUPS #214', '-$7.02'], ['VERIZON WIRELESS', '-$85.00'], ['Zelle to Mom', '-$40.00']]],
  ['Mon, Nov 16', [['SHELL OIL 57442', '-$45.12'], ['MONTHLY SERVICE FEE', '-$12.00']]],
]
const bank = (dark) => `<!doctype html><html><head><style>
  body{margin:0;font:17px -apple-system,'Helvetica Neue',Arial,sans-serif;background:${dark ? '#000' : '#f2f2f7'};color:${dark ? '#fff' : '#000'}}
  .top{padding:56px 20px 12px;font-weight:700;font-size:28px}.bal{padding:0 20px 18px;color:${dark ? '#98989d' : '#6c6c70'};font-size:15px}
  .h{padding:18px 20px 6px;font-size:13px;font-weight:600;text-transform:uppercase;color:${dark ? '#98989d' : '#6c6c70'}}
  .r{display:flex;justify-content:space-between;padding:14px 20px;background:${dark ? '#1c1c1e' : '#fff'};border-bottom:1px solid ${dark ? '#2c2c2e' : '#e5e5ea'}}
  .in{color:${dark ? '#30d158' : '#248a3d'}}</style></head><body>
  <div class="top">Checking ••••4242</div><div class="bal">Available balance $1,204.33</div>
  ${bankRows.map(([h, rows]) => `<div class="h">${h}</div>${rows.map(([m, a]) => `<div class="r"><span>${m}</span><span class="${a[0] === '+' ? 'in' : ''}">${a}</span></div>`).join('')}`).join('')}
  </body></html>`
const stub = `<!doctype html><html><head><style>body{margin:0;padding:40px 22px;font:16px Arial,sans-serif;background:#fff;color:#111}
  h1{font-size:22px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:14px}td{padding:7px 0;border-bottom:1px solid #ddd}td+td{text-align:right}
  .m{color:#555;font-size:14px}</style></head><body><h1>ACME MILLING CO</h1><div class="m">Earnings Statement</div>
  <div class="m" style="margin-top:12px">Pay Period: 11/02/2026 - 11/15/2026</div><div class="m">Pay Date: 11/20/2026</div>
  <table><tr><td><b>Description</b></td><td><b>Current</b></td><td><b>YTD</b></td></tr>
  <tr><td>Gross Pay</td><td>2,240.00</td><td>41,880.00</td></tr><tr><td>Federal Income Tax</td><td>182.10</td><td>3,402.11</td></tr>
  <tr><td>Social Security</td><td>138.88</td><td>2,596.56</td></tr><tr><td>Medicare</td><td>32.48</td><td>607.26</td></tr>
  <tr><td>Health Insurance</td><td>201.14</td><td>4,069.95</td></tr><tr><td><b>Net Pay</b></td><td><b>1,685.40</b></td><td><b>31,204.12</b></td></tr></table>
  <div class="m" style="margin-top:14px">Direct Deposit ****4242</div></body></html>`
const receipt = `<!doctype html><html><head><style>body{margin:0;padding:40px 30px;font:18px 'Courier New',monospace;background:#fbfaf7;color:#111}
  .c{text-align:center}.r{display:flex;justify-content:space-between}</style></head><body>
  <div class="c"><b>ALLSUPS #214</b><br>123 MAIN ST<br>HEREFORD TX 79045<br>(806) 555-0199</div><br>
  <div class="r"><span>11/19/2026</span><span>07:42 AM</span></div><br>
  <div class="r"><span>COFFEE LG</span><span>2.49</span></div><div class="r"><span>BURRITO</span><span>3.99</span></div><br>
  <div class="r"><span>SUBTOTAL</span><span>6.48</span></div><div class="r"><span>TAX</span><span>0.54</span></div>
  <div class="r"><b>TOTAL</b><b>7.02</b></div><div class="r"><span>VISA ****1111</span><span>7.02</span></div><br><div class="c">THANK YOU</div></body></html>`

const bankAnswers = [
  ['SONIC', 9.41, 'expense', '2026-11-21'], ['NETFLIX', 15.49, 'expense', '2026-11-21'], ['PAYROLL', 1685.4, 'income', '2026-11-20'],
  ['WALMART', 64.2, 'expense', '2026-11-20'], ['ALLSUPS', 7.02, 'expense', '2026-11-18'], ['VERIZON', 85, 'expense', '2026-11-18'],
  ['Zelle', 40, 'expense', '2026-11-18'], ['SHELL', 45.12, 'expense', '2026-11-16'], ['SERVICE FEE', 12, 'expense', '2026-11-16'],
]
const shots = [
  ['bank-light', bank(false), bankAnswers],
  ['bank-dark', bank(true), bankAnswers],
  ['pay-stub', stub, [['Paycheck', 1685.4, 'income', '2026-11-20']]],
  ['receipt', receipt, [['ALLSUPS', 7.02, 'expense', '2026-11-19']]],
]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 })
const answers = {}
for (const [name, html, key] of shots) {
  await page.setContent(html)
  await page.screenshot({ path: `${OUT}${name}.png` })
  answers[name] = key
}
// For the privacy checks: a full card number in a transaction name must be masked before review.
await page.setContent(`<!doctype html><html><head><style>body{margin:0;font:17px Arial,sans-serif;background:#fff;color:#000}
  .h{padding:18px 20px 6px;font-size:13px;font-weight:600;color:#6c6c70}.r{display:flex;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #e5e5ea}</style></head><body>
  <div class="h">Oct 20</div><div class="r"><span>Transfer to 4111111111111111</span><span>-$40.00</span></div>
  <div class="r"><span>SONIC DRIVE IN</span><span>-$9.41</span></div><div class="h">Oct 17</div><div class="r"><span>PAYROLL DIRECT DEP</span><span>+$1,685.40</span></div></body></html>`)
await page.screenshot({ path: `${OUT}masking.png` })

// Harder: an older phone (2x) saved as a heavily compressed JPEG (forwarded / re-saved screenshot).
{
  const small = await browser.newPage({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 })
  await small.setContent(bank(false))
  await small.screenshot({ path: `${OUT}bank-compressed.jpg`, type: 'jpeg', quality: 45 })
  // Only the rows that fit on the shorter screen.
  answers['bank-compressed'] = bankAnswers.slice(0, 7)
}
writeFileSync(`${OUT}answers.json`, JSON.stringify({ today: '2026-11-21', note: 'Made-up data. [merchant contains, amount, type, date]', answers }, null, 1))
await browser.close()
console.log('wrote', Object.keys(answers).join(', '))

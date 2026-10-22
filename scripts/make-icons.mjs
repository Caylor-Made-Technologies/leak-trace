// Writes the logo files in brand/ and the app icons in public/icons/.
// Run: npm run icons  (renders PNGs with headless Chromium via Playwright)
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { iconSVG, lockupSVG, markSVG } from './brand.mjs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright')

const files = {
  'brand/logo-mark.svg': markSVG(),
  'brand/logo-mark-on-light.svg': markSVG({ dark: false }),
  'brand/app-icon.svg': iconSVG({ radius: 112 }),
  'brand/logo-horizontal.svg': lockupSVG({ dark: true }),
  'brand/logo-horizontal-on-light.svg': lockupSVG({ dark: false }),
  'public/icons/favicon.svg': iconSVG({ radius: 112, simple: true }),
}
for (const [f, s] of Object.entries(files)) writeFileSync(f, s)

const pngs = [
  ['public/icons/icon-512.png', 512, iconSVG()],
  ['public/icons/icon-192.png', 192, iconSVG()],
  ['public/icons/icon-maskable-512.png', 512, iconSVG({ scale: 0.7 })],
  ['public/icons/apple-touch-icon.png', 180, iconSVG()],
  ['public/icons/favicon-32.png', 32, iconSVG({ radius: 112, simple: true })],
  ['brand/logo-mark.png', 1024, markSVG()],
  ['brand/app-icon-1024.png', 1024, iconSVG()],
  ['brand/logo-horizontal.png', [3000, 1024], lockupSVG({ dark: true })],
  ['brand/logo-horizontal-on-light.png', [3000, 1024], lockupSVG({ dark: false })],
]
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [file, size, svg] of pngs) {
  const [w, h] = Array.isArray(size) ? size : [size, size]
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${w}" height="${h}" `)}</body></html>`)
  await page.waitForTimeout(150)
  await page.screenshot({ path: file, omitBackground: true })
}
await browser.close()
console.log('brand files and icons written')

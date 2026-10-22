// Renders the app icons from SVG with headless Chromium.
// Run: node scripts/make-icons.mjs (needs Playwright installed globally)
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright')

const svg = (pad, round) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3d8bff"/><stop offset="1" stop-color="#0f3fa8"/></linearGradient>
    <radialGradient id="glow" cx="0.3" cy="0.2" r="0.8"><stop offset="0" stop-color="#ffffff" stop-opacity="0.25"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="512" height="512" rx="${round}" fill="url(#g)"/>
  <rect width="512" height="512" rx="${round}" fill="url(#glow)"/>
  <g transform="translate(256 256) scale(${(512 - pad * 2) / 512}) translate(-256 -256)">
    <path d="M222 92s92 98 92 162a92 92 0 0 1-184 0c0-64 92-162 92-162z" fill="#fff"/>
    <text x="222" y="300" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="120" fill="#1b63eb">$</text>
    <circle cx="336" cy="336" r="70" fill="none" stroke="#fff" stroke-width="30"/>
    <path d="M386 386 440 440" stroke="#fff" stroke-width="38" stroke-linecap="round"/>
  </g>
</svg>`

const out = [
  ['public/icons/icon-512.png', 512, svg(40, 0)],
  ['public/icons/icon-192.png', 192, svg(40, 0)],
  ['public/icons/icon-maskable-512.png', 512, svg(110, 0)],
  ['public/icons/apple-touch-icon.png', 180, svg(40, 0)],
  ['public/icons/favicon-32.png', 32, svg(10, 110)],
]
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [file, size, s] of out) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;background:transparent">${s.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`)
  await page.screenshot({ path: file, omitBackground: true })
}
await browser.close()
console.log('icons written')

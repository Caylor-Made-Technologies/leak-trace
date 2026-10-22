// Money Leak Finder brand artwork, drawn in code so every size stays sharp.
// Style follows the Caylor Made Technologies mark: parallel circuit traces in
// white + brand blue, hollow solder-pad nodes, a blue symbol inside.
import { readFileSync } from 'node:fs'

export const BLUE = '#1E6FFF'
export const GLOW = '#3D8BFF'
export const NAVY = '#0B0F14'

import { DOLLAR, DOLLAR_BAR, DRIP, OUTER, OUTLINES, PADS, TRACES } from '../src/lib/brandMark.js'

// The mark. ink = main line colour (white on dark, navy on light).
// bold = one thick outline + $ only, for tiny favicons.
export function markBody({ ink = '#FFFFFF', accent = GLOW, traces = true, drip = true, bold = false } = {}) {
  const col = (role) => (role === 'ink' ? ink : accent)
  const line = (d, c, w = 8) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`
  if (bold) return line(OUTER, ink, 26) + line(DOLLAR, accent, 34) + line('M256 186 V214 M256 348 V376', accent, 34)
  let s = ''
  if (traces) {
    for (const [d, role] of TRACES) s += line(d, col(role))
    for (const [x, y] of PADS) s += `<circle cx="${x}" cy="${y}" r="13" fill="none" stroke="${accent}" stroke-width="7"/>`
  }
  for (const [d, role, w] of OUTLINES) s += line(d, col(role), w)
  s += `<g filter="url(#mlfGlow)">${line(DOLLAR, accent, 20)}${line(DOLLAR_BAR, accent, 20)}</g>`
  if (drip) s += `<path d="${DRIP}" fill="${accent}"/>`
  return s
}

const defs = `<defs>
  <filter id="mlfGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <radialGradient id="mlfBg" cx="0.5" cy="0.38" r="0.75"><stop offset="0" stop-color="#14254a"/><stop offset="0.55" stop-color="#0d1524"/><stop offset="1" stop-color="${NAVY}"/></radialGradient>
</defs>`

// Transparent mark (for dark backgrounds by default).
export function markSVG({ dark = true, size } = {}) {
  const wh = size ? ` width="${size}" height="${size}"` : ''
  const ink = dark ? '#FFFFFF' : '#0B1A33'
  const accent = dark ? GLOW : '#1B63EB'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"${wh} role="img" aria-label="Money Leak Finder logo">${defs}${markBody({ ink, accent })}</svg>`
}

// App icon: navy tile with a faint grid. `scale` shrinks the mark for maskable icons.
export function iconSVG({ scale = 0.86, radius = 0, simple = false } = {}) {
  if (simple) {
    // Favicon: zoom in on the drop and use the bold version.
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}
  <rect width="512" height="512" rx="${radius}" fill="url(#mlfBg)"/>
  <g transform="translate(256 256) scale(1.2) translate(-256 -256)">${markBody({ bold: true })}</g></svg>`
  }
  const t = (1 - scale) * 256
  const grid = Array.from({ length: 15 }, (_, i) => `<path d="M${i * 36 + 4} 0V512M0 ${i * 36 + 4}H512" stroke="#3D8BFF" stroke-opacity="0.06" stroke-width="2"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}
  <rect width="512" height="512" rx="${radius}" fill="url(#mlfBg)"/>${simple ? '' : grid}
  <g transform="translate(${t} ${t}) scale(${scale})">${markBody({ traces: !simple })}</g></svg>`
}

// Horizontal logo: mark + outlined wordmark, like the Caylor Made lockup.
// The outline is made with a mask (stroke minus fill) so overlapping letter
// shapes inside the font don't show as stray lines.
export function lockupSVG({ dark = true } = {}) {
  const ink = dark ? '#FFFFFF' : '#0B1A33'
  const GLOW = dark ? '#3D8BFF' : '#1B63EB'
  const font = readFileSync(new URL('../node_modules/@fontsource/montserrat/files/montserrat-latin-800-normal.woff2', import.meta.url)).toString('base64')
  const word = (fill, stroke, w) => `<text x="540" y="262" class="w" font-size="112" letter-spacing="3" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round">MONEY LEAK</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 512" role="img" aria-label="Money Leak Finder">
  <style>@font-face{font-family:'MLF Montserrat';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:800}
  .w{font-family:'MLF Montserrat',Montserrat,Arial,sans-serif;font-weight:800}</style>${defs}
  <mask id="mlfWord" maskUnits="userSpaceOnUse" x="0" y="0" width="1500" height="512">
    ${word('#fff', '#fff', 14)}
    ${word('#000', 'none', 0)}
  </mask>
  ${markBody({ ink, accent: GLOW })}
  <rect x="520" y="100" width="980" height="200" fill="${ink}" mask="url(#mlfWord)"/>
  <text x="544" y="372" class="w" font-size="66" letter-spacing="49" fill="${GLOW}">FINDER</text>
  <path d="M540 410 H1020 L1040 430 H1250" fill="none" stroke="${GLOW}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="1265" cy="430" r="13" fill="none" stroke="${GLOW}" stroke-width="6"/>
</svg>`
}

// Geometry of the Money Leak Finder mark on a 512 x 512 grid.
// Shared by the in-app logo and the brand file generator (scripts/brand.mjs).

export function dropPath(cx, cy, r, tip) {
  const k = cy - tip
  return [
    `M${cx} ${tip}`,
    `C${cx + r * 0.32} ${tip + k * 0.38} ${cx + r} ${cy - r * 0.62} ${cx + r} ${cy}`,
    `A${r} ${r} 0 0 1 ${cx - r} ${cy}`,
    `C${cx - r} ${cy - r * 0.62} ${cx - r * 0.32} ${tip + k * 0.38} ${cx} ${tip}Z`,
  ].join(' ')
}

// Circuit traces: [path, colour role ('ink' | 'accent')]
export const TRACES = [
  ['M372 216 L408 180 H448', 'ink'],
  ['M392 270 H464', 'accent'],
  ['M386 330 L410 354 H446', 'ink'],
  ['M137 222 L101 186 H70', 'accent'],
  ['M121 330 H74 L50 354', 'ink'],
]
export const PADS = [[461, 180], [477, 270], [459, 354], [57, 186], [37, 354]]

// Three parallel outlines: [path, role, stroke width]
export const OUTLINES = [
  [dropPath(256, 292, 138, 58), 'ink', 10],
  [dropPath(256, 294, 116, 98), 'accent', 9],
  [dropPath(256, 296, 96, 136), 'ink', 6],
]
export const OUTER = OUTLINES[0][0]

export const DOLLAR = 'M292 236 C281 220 263 214 247 215 C228 216 214 228 214 245 C214 263 230 271 256 279 C283 287 299 296 299 316 C299 335 282 347 259 347 C239 347 222 338 212 322'
export const DOLLAR_BAR = 'M256 192 V214 M256 348 V370'
export const DRIP = dropPath(256, 466, 13, 436)

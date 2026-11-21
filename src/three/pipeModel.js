// The piping run, as data. One model feeds both the 3D scene (pipeScene.js) and the flat drawing
// (PipeRun.jsx), so they always show the same thing. Pure: no three.js, no DOM.
//
// Money flows in from the left (pay) along one pipe. Every open leak this month is a joint on the
// pipe; the bigger the leak per year, the bigger the drip. The leak in focus glows and the flow
// particles run toward it.

/** The pipe centerline (meters): a run with two elbows, lying on the floor. */
export const PATH = [
  [-3.2, 0.35, -0.6], [-1.9, 0.35, -0.6], [-1.3, 0.35, -0.6], [-1.0, 0.35, -0.3],
  [-0.7, 0.35, 0.3], [-0.4, 0.35, 0.6], [0.2, 0.35, 0.6], [0.9, 0.35, 0.6],
  [1.2, 0.35, 0.3], [1.5, 0.35, -0.3], [1.8, 0.35, -0.6], [3.2, 0.35, -0.6],
]
export const MAX_POINTS = 5

const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
const SEG = PATH.slice(1).map((p, i) => len(PATH[i], p))
const TOTAL = SEG.reduce((s, x) => s + x, 0)

/** Point on the polyline at fraction t (0..1) by length. */
export function pointAt(t) {
  let d = Math.min(1, Math.max(0, t)) * TOTAL
  for (let i = 0; i < SEG.length; i++) {
    if (d <= SEG[i] || i === SEG.length - 1) {
      const k = SEG[i] ? Math.min(1, d / SEG[i]) : 0
      const a = PATH[i], b = PATH[i + 1]
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
    }
    d -= SEG[i]
  }
  return PATH[PATH.length - 1]
}

/**
 * @param {{id: string, title?: string, yearly: number}[]} leaks open leaks, in the order the list shows them
 * @param {string|null} focusId the leak to light up (falls back to the biggest)
 */
export function buildModel(leaks, focusId) {
  const list = (Array.isArray(leaks) ? leaks : []).filter((l) => l && typeof l.id === 'string' && Number.isFinite(l.yearly) && l.yearly > 0).slice(0, MAX_POINTS)
  if (!list.length) return { points: [], focus: null, flowTo: 1, total: 0 }
  const max = Math.max(...list.map((l) => l.yearly))
  const biggest = list.reduce((a, b) => (b.yearly > a.yearly ? b : a))
  const focus = list.find((l) => l.id === focusId) ?? biggest
  const n = list.length
  const points = list.map((l, i) => {
    const t = n === 1 ? 0.55 : 0.2 + (0.66 * i) / (n - 1)
    return {
      id: l.id, title: l.title || '', yearly: l.yearly, t, pos: pointAt(t),
      size: 0.35 + 0.65 * Math.sqrt(l.yearly / max), // area ~ money
      focus: l.id === focus.id,
    }
  })
  const fp = points.find((p) => p.focus)
  return { points, focus: fp, flowTo: fp.t, total: list.reduce((s, l) => s + l.yearly, 0) }
}

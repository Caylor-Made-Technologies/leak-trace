// A small stand-in for the parts of the `motion` library this app used (aliased as 'motion/react' in
// vite.config.js). Same props, ~3 KB instead of 46 KB gzip, so the first screen loads under budget.
// Enter/change animations run on the Web Animations API; exit animations are skipped (things leave at
// once); looping animations play once (calm screens). Everything is instant under Reduce Motion.
import { interpolate } from './interpolate.js'
import { createElement, forwardRef, Fragment, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

const RM = '(prefers-reduced-motion: reduce)'
const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.(RM).matches
export function useReducedMotion() {
  return useSyncExternalStore((fn) => { const m = window.matchMedia?.(RM); m?.addEventListener('change', fn); return () => m?.removeEventListener('change', fn) }, reduced, () => false)
}
export const AnimatePresence = ({ children }) => createElement(Fragment, null, children)
export const MotionConfig = ({ children }) => createElement(Fragment, null, children)

// ---------- Motion values ----------
class MotionValue {
  constructor(v) { this.v = v; this.subs = new Set() }
  get() { return this.v }
  set(v) { this.v = v; for (const f of this.subs) f(v) }
  on(_ev, f) { this.subs.add(f); return () => this.subs.delete(f) }
}
const isMV = (x) => x instanceof MotionValue
export function useMotionValue(v) { const r = useRef(null); if (!r.current) r.current = new MotionValue(v); return r.current }

export function useTransform(mv, input, output) {
  const r = useRef(null)
  if (!r.current) { r.current = new MotionValue(interpolate(input, output, mv.get())); mv.on('change', (v) => r.current.set(interpolate(input, output, v))) }
  return r.current
}

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
const easeFn = (t) => 1 - Math.pow(1 - t, 3)
const seconds = (tr = {}) => (tr.type === 'spring' ? 0.42 : tr.duration ?? 0.3)

/** Tween a number (or a MotionValue) to `to`. Returns { stop }. */
export function animate(from, to, opts = {}) {
  const mv = isMV(from) ? from : null
  const a = mv ? mv.get() : from
  const dur = reduced() ? 0 : seconds(opts) * 1000
  let raf = 0
  const t0 = performance.now()
  const step = (now) => {
    const k = dur ? Math.min(1, (now - t0) / dur) : 1
    const v = a + (to - a) * easeFn(k)
    if (mv) mv.set(v); else opts.onUpdate?.(v)
    if (k < 1) raf = requestAnimationFrame(step); else opts.onComplete?.()
  }
  raf = requestAnimationFrame(step)
  return { stop: () => cancelAnimationFrame(raf) }
}

// ---------- Drag (pointer events) ----------
export function useDragControls() {
  const r = useRef(null)
  if (!r.current) r.current = { handler: null, start(e) { this.handler?.(e) } }
  return r.current
}

// ---------- Style helpers ----------
const TRANSFORM = ['x', 'y', 'scale', 'rotate']
const unit = (k, v) => (typeof v === 'number' ? (k === 'rotate' ? `${v}deg` : k === 'scale' ? `${v}` : `${v}px`) : v)
function toCss(state, svgPath) {
  const out = {}
  const tf = []
  for (const [k, v0] of Object.entries(state || {})) {
    const v = Array.isArray(v0) ? v0[v0.length - 1] : v0
    if (k === 'transition') continue
    if (k === 'x') tf.push(`translateX(${unit(k, v)})`)
    else if (k === 'y') tf.push(`translateY(${unit(k, v)})`)
    else if (k === 'scale') tf.push(`scale(${v})`)
    else if (k === 'rotate') tf.push(`rotate(${unit(k, v)})`)
    else if (k === 'pathLength' && svgPath) { out.strokeDasharray = '1'; out.strokeDashoffset = String(1 - v) }
    else out[k] = typeof v === 'number' && !['opacity', 'strokeDashoffset'].includes(k) ? `${v}px` : v
  }
  if (tf.length) out.transform = tf.join(' ')
  return out
}
// Resting values that would still change layout if left inline: a transform or filter on an ancestor makes
// it the containing block for position: fixed children (sheets, toasts), so identity values are cleared.
const IDENTITY = /^(translate[XY]\(0(px|%)?\)|scale\(1\)|rotate\(0(deg)?\)|\s)*$/
function atRest(css) {
  const out = { ...css }
  if (out.transform !== undefined && IDENTITY.test(out.transform)) out.transform = ''
  if (out.filter !== undefined && /^(blur\(0(px)?\)|none)$/.test(out.filter)) out.filter = ''
  return out
}
const pick = (v, variants, custom) => {
  const x = typeof v === 'string' ? variants?.[v] : v
  return typeof x === 'function' ? x(custom) : x
}
const OMIT = new Set(['initial', 'animate', 'exit', 'transition', 'whileTap', 'whileHover', 'whileInView', 'whileFocus', 'layout', 'layoutId', 'variants', 'custom', 'drag', 'dragConstraints', 'dragElastic', 'dragListener', 'dragControls', 'dragDirectionLock', 'dragMomentum', 'onDragEnd', 'onDragStart', 'onAnimationComplete', 'viewport'])

function make(tag) {
  const C = forwardRef(function Motion(props, fwd) {
    const el = useRef(null)
    const setRef = (n) => { el.current = n; if (typeof fwd === 'function') fwd(n); else if (fwd) fwd.current = n }
    const { initial, animate: target, transition, variants, custom, style, whileTap, drag, dragControls, dragListener, onDragEnd } = props
    const svgPath = tag === 'path' || tag === 'circle' || tag === 'ellipse'
    const tgt = pick(target, variants, custom)
    const first = useRef(true)
    const last = useRef(null)
    const [, force] = useState(0)

    // Motion values in style: read now, re-render the style on change (cheap: only a few rows use this).
    const mvs = Object.entries(style || {}).filter(([, v]) => isMV(v))
    useEffect(() => { const offs = mvs.map(([, v]) => v.on('change', () => apply())); return () => offs.forEach((f) => f()) })
    const apply = () => {
      const n = el.current
      if (!n) return
      const st = {}
      for (const [k, v] of mvs) st[k] = v.get()
      Object.assign(n.style, toCss(st, svgPath))
    }

    useLayoutEffect(() => {
      const n = el.current
      if (!n || !tgt) return
      const to = toCss(tgt, svgPath)
      const fromState = first.current ? (initial === false ? null : pick(initial, variants, custom)) : last.current
      first.current = false
      last.current = tgt
      Object.assign(n.style, atRest(to))
      if (!fromState || reduced() || typeof n.animate !== 'function') return
      const from = toCss(fromState, svgPath)
      const keys = Object.keys(to).filter((k) => k in from && from[k] !== to[k])
      if (!keys.length) return
      const tr = { ...(transition || {}), ...(tgt.transition || {}) }
      try {
        n.animate([Object.fromEntries(keys.map((k) => [k, from[k]])), Object.fromEntries(keys.map((k) => [k, to[k]]))],
          { duration: seconds(tr) * 1000, delay: (tr.delay || 0) * 1000, easing: EASE, fill: 'backwards' })
      } catch { /* unsupported value: the end state is already set */ }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(tgt)])

    // Drag on one axis: follows the finger, reports offset and velocity on release, springs back.
    useEffect(() => {
      const n = el.current
      if (!n || !drag) return
      const axis = drag === 'y' ? 'y' : 'x'
      const mv = isMV(style?.[axis]) ? style[axis] : null
      let s = null
      const move = (e) => {
        if (!s) return
        const d = axis === 'x' ? e.clientX - s.x : e.clientY - s.y
        if (!s.locked && Math.abs(axis === 'x' ? e.clientY - s.y : e.clientX - s.x) > Math.abs(d) + 4) { s = null; return } // the other way: let it scroll
        s.locked = true
        s.d = d < 0 ? d * (axis === 'x' ? 0.7 : 0.05) * 1.4 : d * (axis === 'x' ? 0.05 : 0.6) * 1.4
        s.v = (s.d - s.pd) / Math.max(1, e.timeStamp - s.pt) * 1000; s.pd = s.d; s.pt = e.timeStamp
        if (mv) mv.set(s.d); else n.style.transform = axis === 'x' ? `translateX(${s.d}px)` : `translateY(${s.d}px)`
      }
      const up = () => {
        if (!s) return
        const info = { offset: { x: axis === 'x' ? s.d : 0, y: axis === 'y' ? s.d : 0 }, velocity: { x: axis === 'x' ? s.v : 0, y: axis === 'y' ? s.v : 0 } }
        if (!mv) n.style.transform = ''
        s = null
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up)
        onDragEnd?.(null, info)
      }
      const start = (e) => {
        s = { x: e.clientX, y: e.clientY, d: 0, pd: 0, v: 0, pt: e.timeStamp, locked: false }
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
      }
      if (dragControls) dragControls.handler = start
      if (dragListener !== false) n.addEventListener('pointerdown', start)
      return () => { n.removeEventListener('pointerdown', start); up() }
    })

    const rest = {}
    for (const [k, v] of Object.entries(props)) if (!OMIT.has(k)) rest[k] = v
    const st = {}
    for (const [k, v] of Object.entries(style || {})) st[k] = isMV(v) ? v.get() : v
    rest.style = { ...toCss(Object.fromEntries(Object.entries(st).filter(([k]) => TRANSFORM.includes(k) || k === 'pathLength')), svgPath), ...Object.fromEntries(Object.entries(st).filter(([k]) => !TRANSFORM.includes(k) && k !== 'pathLength')) }
    if (whileTap) rest.className = `${props.className || ''} press`.trim()
    if (svgPath && (tgt?.pathLength !== undefined || pick(initial, variants, custom)?.pathLength !== undefined)) rest.pathLength = 1
    rest.ref = setRef
    void force
    return createElement(tag, rest)
  })
  C.displayName = `motion.${tag}`
  return C
}

const cache = new Map()
export const motion = new Proxy({}, { get: (_t, tag) => { if (!cache.has(tag)) cache.set(tag, make(tag)); return cache.get(tag) } })

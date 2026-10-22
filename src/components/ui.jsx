import { useEffect, useRef, useState } from 'react'
import { animate, motion, AnimatePresence, useDragControls, useReducedMotion } from 'motion/react'
import { formatMoney } from '../lib/money.js'

export const spring = { type: 'spring', stiffness: 420, damping: 32 }
export const softSpring = { type: 'spring', stiffness: 260, damping: 26 }

export function haptic(ms = 8) {
  try { navigator.vibrate?.(ms) } catch {}
}

export function Card({ className = '', children, ...rest }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={softSpring}
      className={`rounded-3xl border border-line bg-card shadow-card p-4 ${className}`}
      {...rest}
    >
      {children}
    </motion.section>
  )
}

export function Button({ variant = 'primary', className = '', children, onClick, ...rest }) {
  const styles = {
    primary: 'bg-brand text-white shine shadow-[0_8px_24px_-8px_rgba(27,99,235,0.8)]',
    ghost: 'bg-card-2 text-ink border border-line',
    danger: 'bg-[#b42318] text-white',
    plain: 'text-accent',
  }
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      transition={spring}
      onClick={(e) => { haptic(); onClick?.(e) }}
      className={`min-h-12 rounded-2xl px-4 font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  )
}

export function IconButton({ label, className = '', children, ...rest }) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      transition={spring}
      aria-label={label}
      title={label}
      className={`h-11 w-11 shrink-0 grid place-items-center rounded-2xl text-ink hover:bg-card-2 ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  )
}

// Money that counts up/down smoothly when it changes, and blurs in privacy mode.
export function Money({ cents, whole = true, className = '', sign = false }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const prev = useRef(cents)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const from = prev.current
    prev.current = cents
    const text = (v) => (sign && v > 0 ? '+' : '') + formatMoney(Math.round(v), { whole })
    if (reduce || from === cents) { el.textContent = text(cents); return }
    const ctl = animate(from, cents, { duration: 0.9, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => { el.textContent = text(v) } })
    return () => ctl.stop()
  }, [cents, whole, sign, reduce])
  return <span ref={ref} className={`money tnum ${className}`}>{(sign && cents > 0 ? '+' : '') + formatMoney(cents, { whole })}</span>
}

export function Amount({ cents, whole = false, className = '' }) {
  return <span className={`money tnum ${className}`}>{formatMoney(cents, { whole })}</span>
}

// Bottom sheet: springs up, drag down to close, Escape closes, focus is trapped.
export function Sheet({ open, onClose, title, children, full = false }) {
  const panel = useRef(null)
  const controls = useDragControls()
  useEffect(() => {
    if (!open) return
    const prevFocus = document.activeElement
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    setTimeout(() => panel.current?.querySelector('h2')?.focus(), 50)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prevFocus?.focus?.()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="presentation">
          <motion.div
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`relative w-full max-w-lg rounded-t-[28px] border-t border-line-2 bg-bg-2 shadow-2xl safe-bottom flex flex-col ${full ? 'h-[92dvh]' : 'max-h-[90dvh]'}`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragListener={false}
            dragControls={controls}
            onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 600) onClose() }}
          >
            <div
              className="flex justify-center pt-2.5 pb-1.5 touch-none cursor-grab"
              onPointerDown={(e) => controls.start(e)}
              aria-hidden="true"
            >
              <div className="h-1.5 w-11 rounded-full bg-line-2" />
            </div>
            <div className="flex items-center justify-between px-5 pb-2">
              <h2 tabIndex={-1} className="font-display text-lg font-bold outline-none">{title}</h2>
              <IconButton label="Close" onClick={onClose}><XIcon /></IconButton>
            </div>
            <div className="overflow-y-auto px-5 pb-4 overscroll-contain">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div role="tablist" aria-label={label} className="relative flex rounded-2xl bg-card-2 p-1 border border-line">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => { haptic(); onChange(o.value) }}
          className={`relative flex-1 min-h-11 rounded-xl text-sm font-semibold ${value === o.value ? 'bg-brand text-white' : 'text-muted'}`}
        >
          {value === o.value && (
            <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-xl bg-brand" transition={spring} />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function Chip({ active, children, className = '', ...rest }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      transition={spring}
      aria-pressed={active}
      className={`min-h-11 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors ${active ? 'border-brand-2 bg-brand/20 text-ink' : 'border-line bg-card-2 text-muted'} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  )
}

export function Field({ label, hint, children, id }) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-sm font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  )
}

export const inputClass = 'w-full min-h-12 rounded-2xl border border-line bg-card px-4 text-ink placeholder:text-faint focus:border-brand-2 focus:outline-none'

export function ProgressRing({ value, size = 64, stroke = 7, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-2)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ringGrad)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(1, Math.max(0, value))) }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3d8bff" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-xs font-bold">{children}</div>
    </div>
  )
}

// Burst of confetti for wins (goal reached, leak plugged).
export function Confetti({ show, onDone }) {
  const reduce = useReducedMotion()
  const [pieces] = useState(() => Array.from({ length: 36 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 340,
    y: -(Math.random() * 380 + 120),
    r: Math.random() * 720 - 360,
    c: ['#3d8bff', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#ffffff'][i % 6],
    w: 6 + Math.random() * 6,
    d: Math.random() * 0.15,
  })))
  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => onDone?.(), 1600)
    return () => clearTimeout(t)
  }, [show, onDone])
  if (!show || reduce) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] flex items-end justify-center" aria-hidden="true">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute bottom-24 block rounded-sm"
          style={{ width: p.w, height: p.w * 0.45, background: p.c }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 420], opacity: [1, 1, 0], rotate: p.r }}
          transition={{ duration: 1.5, delay: p.d, ease: 'easeOut', times: [0, 0.4, 1] }}
        />
      ))}
    </div>
  )
}

export function Empty({ emoji, title, children }) {
  return (
    <div className="py-10 text-center">
      <motion.div
        className="mx-auto mb-3 text-5xl"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      >{emoji}</motion.div>
      <p className="font-display text-lg font-bold">{title}</p>
      <div className="mt-1 text-sm text-muted">{children}</div>
    </div>
  )
}

export function XIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
}

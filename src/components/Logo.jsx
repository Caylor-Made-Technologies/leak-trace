import { motion, useReducedMotion } from 'motion/react'
import { DOLLAR, DOLLAR_BAR, DRIP, OUTER, OUTLINES, PADS, TRACES } from '../lib/brandMark.js'

// The app's mark. Traces draw themselves in, the $ glows, and a drip falls.
// `tile` puts it on the navy app-icon tile. `simple` is the bold small-size
// version (one thick outline + $), used in the header like the favicon.
export default function Logo({ size = 40, tile = true, animate = true, simple = false, title }) {
  const reduce = useReducedMotion()
  const live = animate && !reduce
  const ink = tile ? '#FFFFFF' : 'var(--text)'
  const accent = tile ? '#3D8BFF' : 'var(--accent)'
  const col = (role) => (role === 'ink' ? ink : accent)
  const draw = (i) => (live ? { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: { duration: 0.7, delay: 0.1 + i * 0.08, ease: 'easeOut' } } : {})
  const common = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {tile && (
        <>
          <defs>
            <radialGradient id="logoBg" cx="0.5" cy="0.38" r="0.75"><stop offset="0" stopColor="#14254a" /><stop offset="0.55" stopColor="#0d1524" /><stop offset="1" stopColor="#0b0f14" /></radialGradient>
          </defs>
          <rect width="512" height="512" rx="120" fill="url(#logoBg)" />
        </>
      )}
      {simple ? (
        <g transform="translate(256 256) scale(1.2) translate(-256 -256)">
          <motion.path d={OUTER} stroke={ink} strokeWidth={26} {...common} {...draw(0)} />
          <motion.g {...(live ? { initial: { scale: 0.4, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { type: 'spring', stiffness: 380, damping: 14, delay: 0.35 } } : {})} style={{ transformOrigin: '256px 290px' }}>
            <path d={DOLLAR} stroke={accent} strokeWidth={34} {...common} />
            <path d="M256 186 V214 M256 348 V376" stroke={accent} strokeWidth={34} {...common} />
          </motion.g>
        </g>
      ) : (
      <g transform={tile ? 'translate(36 36) scale(0.86)' : undefined}>
        {TRACES.map(([d, role], i) => <motion.path key={d} d={d} stroke={col(role)} strokeWidth={8} {...common} {...draw(i)} />)}
        {PADS.map(([x, y], i) => (
          <motion.circle key={`${x}-${y}`} cx={x} cy={y} r={13} stroke={accent} strokeWidth={7} fill="none"
            {...(live ? { initial: { scale: 0 }, animate: { scale: 1 }, transition: { type: 'spring', stiffness: 500, damping: 14, delay: 0.5 + i * 0.06 } } : {})} />
        ))}
        {OUTLINES.map(([d, role, w], i) => <motion.path key={d} d={d} stroke={col(role)} strokeWidth={w} {...common} {...draw(i + 2)} />)}
        <motion.g
          {...(live ? { animate: { opacity: [0.85, 1, 0.85] }, transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } } : {})}
        >
          <path d={DOLLAR} stroke={accent} strokeWidth={22} {...common} />
          <path d={DOLLAR_BAR} stroke={accent} strokeWidth={22} {...common} />
        </motion.g>
        <motion.path
          d={DRIP}
          fill={accent}
          {...(live ? { animate: { y: [-20, 0, 24], opacity: [0, 1, 0] }, transition: { duration: 1.8, repeat: Infinity, repeatDelay: 1.2, ease: 'easeIn', times: [0, 0.35, 1] } } : {})}
        />
      </g>
      )}
    </svg>
  )
}

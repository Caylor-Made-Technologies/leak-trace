import { motion } from 'motion/react'

// Drop-in-a-magnifier mark. Drawn in code so it stays sharp and needs no image request.
export default function Logo({ size = 36 }) {
  return (
    <motion.svg
      width={size} height={size} viewBox="0 0 48 48" aria-hidden="true"
      initial={{ rotate: -12, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}
    >
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3d8bff" />
          <stop offset="1" stopColor="#1b63eb" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="14" fill="url(#lg)" />
      <path d="M21 10s8 8.6 8 14.2a8 8 0 0 1-16 0C13 18.6 21 10 21 10z" fill="#fff" opacity="0.95" />
      <text x="21" y="28.5" textAnchor="middle" fontFamily="Montserrat, sans-serif" fontWeight="800" fontSize="10" fill="#1b63eb">$</text>
      <circle cx="31" cy="31" r="6.5" fill="none" stroke="#fff" strokeWidth="3" />
      <path d="M35.6 35.6 40 40" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
    </motion.svg>
  )
}

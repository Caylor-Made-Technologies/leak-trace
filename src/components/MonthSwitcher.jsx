import { AnimatePresence, motion } from 'motion/react'
import { useApp } from '../state.jsx'
import { addMonths, currentMonth, monthLabel } from '../lib/dates.js'
import { IconButton, haptic } from './ui.jsx'
import { ChevronLeft, ChevronRight } from './icons.jsx'
import { useState } from 'react'

export default function MonthSwitcher() {
  const { month, setMonth } = useApp()
  const [dir, setDir] = useState(1)
  const isNow = month >= currentMonth()
  const step = (d) => { haptic(); setDir(d); setMonth(addMonths(month, d)) }
  return (
    <div className="mb-3 flex items-center justify-between rounded-2xl border border-line bg-card/70 px-1">
      <IconButton label="Previous month" onClick={() => step(-1)}><ChevronLeft size={22} /></IconButton>
      <div className="relative h-11 flex-1 overflow-hidden text-center">
        <AnimatePresence initial={false} custom={dir}>
          <motion.p
            key={month}
            custom={dir}
            className="absolute inset-0 grid place-items-center font-display font-bold"
            initial={{ x: dir * 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: dir * -60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            aria-live="polite"
          >
            {monthLabel(month)}
          </motion.p>
        </AnimatePresence>
      </div>
      <IconButton label="Next month" onClick={() => step(1)} disabled={isNow} className="disabled:opacity-30"><ChevronRight size={22} /></IconButton>
    </div>
  )
}

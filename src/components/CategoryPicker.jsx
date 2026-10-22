import { motion } from 'motion/react'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../lib/categories.js'
import { haptic } from './ui.jsx'

export default function CategoryPicker({ type, value, onChange }) {
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  return (
    <div role="radiogroup" aria-label="Category" className="grid grid-cols-3 gap-2">
      {list.map((c) => {
        const on = c.id === value
        return (
          <motion.button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={on}
            whileTap={{ scale: 0.9 }}
            onClick={() => { haptic(); onChange(c.id) }}
            className={`relative flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border p-1.5 text-center text-[11px] font-semibold leading-tight transition-colors ${on ? 'border-brand-2 bg-brand/20 text-ink' : 'border-line bg-card text-muted'}`}
          >
            <motion.span className="text-2xl" animate={{ scale: on ? 1.2 : 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }} aria-hidden="true">{c.emoji}</motion.span>
            {c.label}
          </motion.button>
        )
      })}
    </div>
  )
}

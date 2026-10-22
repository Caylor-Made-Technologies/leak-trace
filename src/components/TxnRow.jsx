import { motion, useMotionValue, useTransform, animate } from 'motion/react'
import { cat } from '../lib/categories.js'
import { friendlyDate } from '../lib/dates.js'
import { formatMoney } from '../lib/money.js'
import { haptic } from './ui.jsx'
import { TrashIcon } from './icons.jsx'

// One transaction. Tap to edit; swipe left to delete (with undo in the toast).
export default function TxnRow({ t, onOpen, onDelete, index = 0 }) {
  const c = cat(t.category)
  const x = useMotionValue(0)
  const reveal = useTransform(x, [-110, -40, 0], [1, 0.4, 0])
  const income = t.type === 'income'
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -300, height: 0, marginTop: 0, transition: { duration: 0.25 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 32, delay: Math.min(index, 12) * 0.025 }}
      className="relative overflow-hidden rounded-2xl"
    >
      {onDelete && (
        <motion.div style={{ opacity: reveal }} className="absolute inset-0 flex items-center justify-end rounded-2xl bg-[#b42318] pr-5 text-white" aria-hidden="true">
          <TrashIcon size={22} />
        </motion.div>
      )}
      <motion.button
        style={{ x }}
        drag={onDelete ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.7, right: 0.05 }}
        dragDirectionLock
        onDragEnd={(_, info) => {
          if (info.offset.x < -110 || info.velocity.x < -700) { haptic(18); onDelete(t) }
          else animate(x, 0, { type: 'spring', stiffness: 500, damping: 35 })
        }}
        onClick={() => onOpen?.(t)}
        whileTap={{ scale: 0.98 }}
        className="relative flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-3 py-2.5 text-left"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-card-2 text-xl" aria-hidden="true">{c.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{t.description}</span>
          <span className="block truncate text-xs text-faint">{c.label} · {friendlyDate(t.date)}{t.source === 'screenshot' ? ' · 📸' : ''}</span>
        </span>
        <span className={`money tnum shrink-0 font-bold ${income ? 'text-good' : ''}`}>
          {income ? '+' : '−'}{formatMoney(t.amount)}
        </span>
      </motion.button>
    </motion.li>
  )
}

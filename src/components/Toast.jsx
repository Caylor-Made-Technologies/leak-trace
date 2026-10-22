import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useApp } from '../state.jsx'

export default function Toast() {
  const { toast, setToast } = useApp()
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.action ? 5000 : 2800)
    return () => clearTimeout(t)
  }, [toast, setToast])
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex justify-center px-4" role="status" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ y: 30, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-line-2 bg-card-2 py-2 pl-4 pr-2 shadow-card"
          >
            <span className="text-sm font-medium">{toast.message}</span>
            {toast.action && (
              <button className="min-h-10 rounded-xl px-3 text-sm font-bold text-accent" onClick={() => { toast.action.run(); setToast(null) }}>
                {toast.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

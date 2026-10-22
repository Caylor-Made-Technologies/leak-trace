import { AnimatePresence, motion } from 'motion/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Sheet } from '../components/ui.jsx'
import { CameraIcon, ChevronLeft, FileIcon, PenIcon } from '../components/icons.jsx'
import { addTransactions, getRules, recategorize } from '../db.js'
import { useApp } from '../state.jsx'
import TxnForm from '../components/TxnForm.jsx'
import CsvImport from './add/CsvImport.jsx'
import ScreenshotImport from './add/ScreenshotImport.jsx'
import { db } from '../db.js'

const MODES = [
  { id: 'manual', title: 'Type it in', text: 'One paycheck or purchase', Icon: PenIcon },
  { id: 'csv', title: 'Upload a bank CSV', text: 'Export from your bank’s website', Icon: FileIcon },
  { id: 'screenshot', title: 'Read screenshots', text: 'Pay stubs, bank app lists, receipts', Icon: CameraIcon, badge: 'Smart' },
]

export default function AddSheet({ open, mode, setMode, onClose }) {
  const { showToast, setMonth } = useApp()
  const rules = useLiveQuery(getRules, [], {})
  const title = mode ? MODES.find((m) => m.id === mode).title : 'Add money in or out'

  const saveManual = async (data, { remember }) => {
    const n = await addTransactions([{ ...data, source: 'manual' }])
    if (n && remember) {
      const last = await db.transactions.orderBy('id').last()
      await recategorize(last, data.category, true)
    }
    setMonth(data.date.slice(0, 7))
    showToast(data.type === 'income' ? 'Money in added 💵' : 'Added')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={title} full={mode === 'screenshot' || mode === 'csv'}>
      <AnimatePresence mode="wait" initial={false}>
        {!mode ? (
          <motion.ul key="menu" className="space-y-2.5 pb-2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {MODES.map((m, i) => (
              <motion.li key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setMode(m.id)}
                  className="flex w-full items-center gap-4 rounded-3xl border border-line bg-card p-4 text-left"
                >
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-2 to-brand text-white shadow-[0_8px_20px_-8px_rgba(27,99,235,0.9)]"><m.Icon size={26} /></span>
                  <span className="flex-1">
                    <span className="flex items-center gap-2 font-bold">{m.title}{m.badge && <span className="rounded-full bg-brand/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">{m.badge}</span>}</span>
                    <span className="block text-sm text-muted">{m.text}</span>
                  </span>
                </motion.button>
              </motion.li>
            ))}
            <li className="px-1 pt-1 text-xs text-faint">🔒 Never enter bank logins, full account or card numbers, routing numbers or SSNs. We never ask for them.</li>
          </motion.ul>
        ) : (
          <motion.div key={mode} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <button onClick={() => setMode(null)} className="-ml-2 mb-2 flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-accent"><ChevronLeft size={18} /> Other ways</button>
            {mode === 'manual' && <TxnForm rules={rules} onSave={saveManual} saveLabel="Add it" />}
            {mode === 'csv' && <CsvImport onDone={onClose} />}
            {mode === 'screenshot' && <ScreenshotImport onDone={onClose} />}
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  )
}

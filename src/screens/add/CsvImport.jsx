import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Button } from '../../components/ui.jsx'
import { FileIcon } from '../../components/icons.jsx'
import { parseBankCsv, MAX_CSV_BYTES } from '../../lib/csv.js'
import { addWithoutDuplicates } from '../../db.js'
import { useApp } from '../../state.jsx'
import { formatMoney } from '../../lib/money.js'
import { friendlyDate } from '../../lib/dates.js'

export default function CsvImport({ onDone }) {
  const { showToast, setMonth } = useApp()
  const input = useRef(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [flip, setFlip] = useState(false)
  const [busy, setBusy] = useState(false)

  const onFile = async (file) => {
    setError('')
    setResult(null)
    if (!file) return
    if (file.size > MAX_CSV_BYTES) return setError('That file is too big (5 MB max).')
    if (!/\.(csv|txt)$/i.test(file.name) && !/csv|text/.test(file.type)) return setError('Pick a .csv file exported from your bank.')
    try {
      setResult(parseBankCsv(await file.text()))
    } catch (e) {
      setError(e.message)
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  const rows = result ? result.rows.map((r) => (flip ? { ...r, type: r.type === 'income' ? 'expense' : 'income' } : r)) : []
  const inSum = rows.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0)
  const outSum = rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0)

  const save = async () => {
    setBusy(true)
    const { added, duplicates } = await addWithoutDuplicates(rows.map((r) => ({ ...r, source: 'csv' })))
    setBusy(false)
    const latest = rows.reduce((a, r) => (r.date > a ? r.date : a), '0000')
    if (added) setMonth(latest.slice(0, 7))
    showToast(`Imported ${added}${duplicates ? ` · skipped ${duplicates} already saved` : ''}`)
    onDone()
  }

  return (
    <div className="space-y-4 pb-4">
      <input ref={input} type="file" accept=".csv,text/csv,text/plain" className="sr-only" id="csvfile" onChange={(e) => onFile(e.target.files?.[0])} />
      {!result && (
        <>
          <motion.label
            htmlFor="csvfile"
            whileTap={{ scale: 0.98 }}
            className="flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line-2 bg-card p-6 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]) }}
          >
            <motion.span animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="text-accent"><FileIcon size={40} /></motion.span>
            <span className="font-bold">Choose a CSV file</span>
            <span className="text-sm text-muted">Needs columns like Date, Description, Amount (or Debit/Credit)</span>
          </motion.label>
          <div className="rounded-2xl bg-card-2 p-3 text-sm text-muted">
            <p className="font-semibold text-ink">Where do I get one?</p>
            <p className="mt-1">On your bank’s website: Activity or Statements → Download / Export → CSV. Most banks only offer this on the website, not the app.</p>
            <p className="mt-2">🔒 Account number, balance and card columns are ignored. Long numbers in descriptions are hidden.</p>
          </div>
        </>
      )}
      {error && <p role="alert" className="rounded-xl bg-bad/15 p-3 text-sm font-semibold text-bad">{error}</p>}
      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Found" value={rows.length} />
            <Stat label="Money in" value={formatMoney(inSum, { whole: true })} good />
            <Stat label="Money out" value={formatMoney(outSum, { whole: true })} />
          </div>
          {result.skipped > 0 && <p className="text-xs text-faint">{result.skipped} row{result.skipped > 1 ? 's' : ''} skipped (missing date or amount).</p>}
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {rows.slice(0, 8).map((r, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-14 shrink-0 text-xs text-faint">{friendlyDate(r.date)}</span>
                <span className="flex-1 truncate">{r.description}</span>
                <span className={`money tnum font-semibold ${r.type === 'income' ? 'text-good' : ''}`}>{r.type === 'income' ? '+' : '−'}{formatMoney(r.amount)}</span>
              </li>
            ))}
            {rows.length > 8 && <li className="px-3 py-2 text-xs text-faint">…and {rows.length - 8} more</li>}
          </ul>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} className="h-5 w-5 accent-[#3d8bff]" />
            Money in and out look backwards? Swap them.
          </label>
          <Button className="w-full" onClick={save} disabled={busy || !rows.length}>{busy ? 'Saving…' : `Import ${rows.length} transactions`}</Button>
          <Button variant="ghost" className="w-full" onClick={() => setResult(null)}>Pick a different file</Button>
        </motion.div>
      )}
    </div>
  )
}

function Stat({ label, value, good }) {
  return (
    <div className="rounded-2xl bg-card-2 p-2.5">
      <p className="text-[11px] text-faint">{label}</p>
      <p className={`money tnum font-bold ${good ? 'text-good' : ''}`}>{value}</p>
    </div>
  )
}

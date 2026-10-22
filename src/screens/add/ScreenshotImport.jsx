import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Button, inputClass } from '../../components/ui.jsx'
import { CameraIcon, LockIcon } from '../../components/icons.jsx'
import { XIcon } from '../../components/ui.jsx'
import { MAX_IMAGES, prepareImage } from '../../lib/image.js'
import { extractFromImages, extractionEnabled } from '../../lib/extract.js'
import { addWithoutDuplicates, setSetting } from '../../db.js'
import Policy from '../../components/Policy.jsx'
import { useApp } from '../../state.jsx'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../lib/categories.js'
import { categorize } from '../../lib/categorize.js'
import { parseAmount, formatMoney } from '../../lib/money.js'
import { isValidISO } from '../../lib/dates.js'

const READING = ['Reading your screenshots…', 'Finding dates and amounts…', 'Hiding any account numbers…', 'Sorting money in and out…', 'Almost done…']

export default function ScreenshotImport({ onDone }) {
  const { showToast, setMonth, settings } = useApp()
  const agreedAt = settings.screenshotConsent
  const [agree, setAgree] = useState(false)
  const [showPolicy, setShowPolicy] = useState(false)
  const [images, setImages] = useState([]) // { id, file, url } — memory only, never saved
  const [step, setStep] = useState('pick') // pick | reading | review
  const [rows, setRows] = useState([])
  const [info, setInfo] = useState(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState(0)
  const abort = useRef(null)
  const input = useRef(null)
  const imagesRef = useRef(images)
  imagesRef.current = images

  // Free the images from memory when leaving this screen.
  useEffect(() => () => {
    abort.current?.abort()
    imagesRef.current.forEach((i) => URL.revokeObjectURL(i.url))
  }, [])

  useEffect(() => {
    if (step !== 'reading') return
    const t = setInterval(() => setMsg((m) => (m + 1) % READING.length), 1800)
    return () => clearInterval(t)
  }, [step])

  const clearImages = () => {
    imagesRef.current.forEach((i) => URL.revokeObjectURL(i.url))
    setImages([])
  }

  const addFiles = (files) => {
    setError('')
    const list = [...(files || [])].slice(0, MAX_IMAGES - images.length)
    if (files?.length > list.length) setError(`Up to ${MAX_IMAGES} screenshots at a time.`)
    setImages((prev) => [...prev, ...list.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))])
    if (input.current) input.current.value = ''
  }

  const removeImage = (id) => {
    setImages((prev) => {
      const gone = prev.find((i) => i.id === id)
      if (gone) URL.revokeObjectURL(gone.url)
      return prev.filter((i) => i.id !== id)
    })
  }

  const read = async () => {
    if (!agreedAt) {
      if (!agree) return setError('Please check the box to agree first.')
      await setSetting('screenshotConsent', Date.now())
    }
    setError('')
    setStep('reading')
    setMsg(0)
    abort.current = new AbortController()
    try {
      const prepared = []
      for (const img of images) prepared.push(await prepareImage(img.file))
      const res = await extractFromImages(prepared, { signal: abort.current.signal })
      prepared.length = 0
      setInfo(res)
      setRows(res.rows.map((r) => ({ ...r, category: r.category || categorize(r), amountText: (r.amount / 100).toFixed(2) })))
      setStep('review')
      // Images are no longer needed once read. Drop them right away.
      clearImages()
    } catch (e) {
      if (abort.current?.signal.aborted) return
      setError(e.message || 'Something went wrong.')
      setStep('pick')
    }
  }

  const update = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const save = async () => {
    const ready = rows
      .filter((r) => r.include)
      .map((r) => ({ date: r.date, description: r.description, amount: Math.abs(parseAmount(r.amountText) || 0), type: r.type, category: r.category, source: 'screenshot' }))
      .filter((r) => r.amount > 0 && isValidISO(r.date))
    const { added, duplicates } = await addWithoutDuplicates(ready)
    clearImages()
    setRows([])
    if (added) setMonth(ready.reduce((a, r) => (r.date > a ? r.date : a), '0000').slice(0, 7))
    showToast(`Saved ${added}${duplicates ? ` · ${duplicates} already saved` : ''}. Screenshots deleted.`)
    onDone()
  }

  if (!extractionEnabled()) {
    return (
      <div className="rounded-2xl bg-card-2 p-4 text-sm text-muted">
        <p className="font-semibold text-ink">Screenshot reading isn’t switched on in this copy yet.</p>
        <p className="mt-1">The app owner needs to deploy the secure reader (see the README). Until then, use a bank CSV or type it in.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      <AnimatePresence mode="wait">
        {step === 'pick' && (
          <motion.div key="pick" className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <input ref={input} id="shots" type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} />
            {images.length < MAX_IMAGES && (
              <motion.label
                htmlFor="shots"
                whileTap={{ scale: 0.98 }}
                className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line-2 bg-card p-5 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
              >
                <motion.span animate={{ rotate: [0, -8, 8, 0] }} transition={{ repeat: Infinity, duration: 2.4 }} className="text-accent"><CameraIcon size={40} /></motion.span>
                <span className="font-bold">{images.length ? 'Add another' : 'Choose screenshots'}</span>
                <span className="text-sm text-muted">Pay stubs, bank app transaction lists or receipts · up to {MAX_IMAGES}</span>
              </motion.label>
            )}
            {images.length > 0 && (
              <ul className="grid grid-cols-3 gap-2">
                <AnimatePresence>
                  {images.map((img) => (
                    <motion.li key={img.id} layout initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-line bg-card">
                      <img src={img.url} alt="Selected screenshot" className="h-full w-full object-cover" />
                      <button onClick={() => removeImage(img.id)} aria-label="Remove screenshot" className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-full bg-black/70 text-white"><XIcon /></button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
            <div className="flex gap-3 rounded-2xl bg-card-2 p-3 text-sm text-muted">
              <LockIcon size={20} className="mt-0.5 shrink-0 text-good" />
              <p>Screenshots are shrunk and stripped of location data on your phone, read once, then deleted. They’re never saved. Card and account numbers are hidden (last 4 at most).</p>
            </div>
            {!agreedAt ? (
              <div className="rounded-2xl border border-line bg-card p-3 text-sm">
                <label className="flex min-h-11 items-start gap-3">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 accent-[#3d8bff]" />
                  <span>I’m 18 or older, I agree to the <button type="button" className="font-semibold text-accent underline" onClick={() => setShowPolicy((v) => !v)}>Terms and Privacy Policy</button>, and I’m OK with these screenshots being sent to be read (then deleted).</span>
                </label>
                {showPolicy && <div className="mt-2"><Policy startOpen /></div>}
              </div>
            ) : (
              <p className="text-xs text-faint">You agreed to the terms on {new Date(agreedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.</p>
            )}
            {error && <p role="alert" className="rounded-xl bg-bad/15 p-3 text-sm font-semibold text-bad">{error}</p>}
            <Button className="w-full" disabled={!images.length || (!agreedAt && !agree)} onClick={read}>Read {images.length || ''} screenshot{images.length === 1 ? '' : 's'}</Button>
          </motion.div>
        )}

        {step === 'reading' && (
          <motion.div key="reading" className="py-4 text-center" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <div className="mx-auto flex max-w-xs justify-center gap-2">
              {images.slice(0, 3).map((img, i) => (
                <motion.div key={img.id} className="relative aspect-[3/4] w-24 overflow-hidden rounded-2xl border border-brand-2/60 shadow-[0_0_24px_-4px_rgba(61,139,255,0.6)]" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 1.6, delay: i * 0.2 }}>
                  <img src={img.url} alt="" className="h-full w-full object-cover opacity-70" />
                  <div className="scanline" />
                </motion.div>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.p key={msg} className="mt-6 font-semibold" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} aria-live="polite">{READING[msg]}</motion.p>
            </AnimatePresence>
            <Button variant="ghost" className="mt-6" onClick={() => { abort.current?.abort(); setStep('pick') }}>Cancel</Button>
          </motion.div>
        )}

        {step === 'review' && (
          <motion.div key="review" className="space-y-3" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="rounded-2xl bg-card-2 p-3 text-sm">
              <p className="font-semibold">Found {rows.length} item{rows.length === 1 ? '' : 's'}. Check them before saving.</p>
              <p className="mt-0.5 text-muted">Fix anything that’s off. Uncheck anything you don’t want. Your screenshots are already deleted.</p>
              {(info?.masked || rows.some((r) => r.hadNumber)) && <p className="mt-1.5 text-good">🔒 Account or card numbers were hidden.</p>}
            </div>
            {!rows.length && <p className="py-6 text-center text-muted">No transactions found. Try a clearer screenshot, or type them in.</p>}
            <ul className="space-y-2.5">
              {rows.map((r, i) => <ReviewRow key={r.key} r={r} i={i} update={update} />)}
            </ul>
            {rows.length > 0 && (
              <Button className="sticky bottom-2 w-full" onClick={save} disabled={!rows.some((r) => r.include)}>
                Save {rows.filter((r) => r.include).length} · {formatMoney(rows.filter((r) => r.include).reduce((s, r) => s + Math.abs(parseAmount(r.amountText) || 0), 0))}
              </Button>
            )}
            <Button variant="ghost" className="w-full" onClick={() => { setRows([]); setStep('pick') }}>Start over</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ReviewRow({ r, i, update }) {
  const cats = r.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const low = r.confidence === 'low' || r.dateGuessed
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: r.include ? 1 : 0.5, y: 0 }} transition={{ delay: i * 0.05 }}
      className={`rounded-2xl border bg-card p-3 ${low ? 'border-warn/60' : 'border-line'}`}
    >
      <div className="flex items-center gap-2">
        <input type="checkbox" aria-label={`Include ${r.description}`} checked={r.include} onChange={(e) => update(r.key, { include: e.target.checked })} className="h-6 w-6 shrink-0 accent-[#3d8bff]" />
        <input aria-label="Description" className={`${inputClass} min-h-11 flex-1 px-3`} value={r.description} maxLength={80} onChange={(e) => update(r.key, { description: e.target.value })} />
      </div>
      <div className="mt-2 grid grid-cols-[1fr_1fr] gap-2">
        <input aria-label="Amount" inputMode="decimal" className={`${inputClass} min-h-11 px-3 tnum`} value={r.amountText} onChange={(e) => update(r.key, { amountText: e.target.value.replace(/[^0-9.,]/g, '').slice(0, 12) })} />
        <input aria-label="Date" type="date" className={`${inputClass} min-h-11 px-3`} value={r.date} onChange={(e) => update(r.key, { date: e.target.value, dateGuessed: false })} />
      </div>
      <div className="mt-2 grid grid-cols-[auto_1fr] gap-2">
        <button
          onClick={() => {
            const type = r.type === 'income' ? 'expense' : 'income'
            update(r.key, { type, category: categorize({ ...r, type }) })
          }}
          className={`min-h-11 rounded-2xl px-3 text-sm font-bold ${r.type === 'income' ? 'bg-good/15 text-good' : 'bg-card-2 text-ink'}`}
          aria-label={`Type: ${r.type === 'income' ? 'money in' : 'money out'}. Tap to switch.`}
        >{r.type === 'income' ? '+ In' : '− Out'}</button>
        <select aria-label="Category" className={`${inputClass} min-h-11 px-3`} value={r.category} onChange={(e) => update(r.key, { category: e.target.value })}>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
        </select>
      </div>
      {low && <p className="mt-2 text-xs text-warn">⚠️ {r.dateGuessed ? 'No date found; set to today.' : 'Hard to read. Double-check this one.'}</p>}
    </motion.li>
  )
}

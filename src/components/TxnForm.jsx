import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Button, Field, Segmented, inputClass } from './ui.jsx'
import CategoryPicker from './CategoryPicker.jsx'
import { categorize, merchantKey, prettyMerchant } from '../lib/categorize.js'
import { todayISO, isValidISO } from '../lib/dates.js'
import { parseAmount } from '../lib/money.js'
import { looksSensitive } from '../lib/privacy.js'
import { cat } from '../lib/categories.js'

// Add or edit one transaction. Category is guessed as you type and can be changed.
export default function TxnForm({ initial, rules = {}, onSave, onDelete, saveLabel = 'Save' }) {
  const [type, setType] = useState(initial?.type || 'expense')
  const [amount, setAmount] = useState(initial ? (initial.amount / 100).toFixed(2) : '')
  const [description, setDescription] = useState(initial?.description || '')
  const [date, setDate] = useState(initial?.date || todayISO())
  const [category, setCategory] = useState(initial?.category || null)
  const [touched, setTouched] = useState(!!initial)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')

  const cents = parseAmount(amount)
  const guess = useMemo(() => categorize({ description, amount: Math.abs(cents || 0), type }, rules), [description, cents, type, rules])
  const chosen = touched && category && (type === 'income') === (cat(category).group === 'income') ? category : guess
  const sensitive = looksSensitive(description)

  const submit = (e) => {
    e.preventDefault()
    if (!cents || cents === 0) return setError('Enter an amount, like 12.50')
    if (!description.trim()) return setError('Add a short description, like "Sonic"')
    if (!isValidISO(date)) return setError('Pick a date')
    setError('')
    onSave({ type, amount: Math.abs(cents), description: description.trim(), date, category: chosen }, { remember: touched && remember })
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Segmented label="Money in or out" value={type} onChange={(v) => { setType(v); setTouched(false) }} options={[{ value: 'expense', label: '− Money out' }, { value: 'income', label: '+ Money in' }]} />

      <div className="relative">
        <label htmlFor="amt" className="sr-only">Amount in dollars</label>
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-3xl font-bold text-faint">$</span>
        <input
          id="amt"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 12))}
          className={`${inputClass} h-20 pl-10 font-display text-4xl font-extrabold tnum ${type === 'income' ? 'text-good' : ''}`}
          autoFocus={!initial}
        />
      </div>

      <Field label="What was it?" id="desc">
        <input id="desc" className={inputClass} value={description} maxLength={80} placeholder={type === 'income' ? 'Paycheck' : 'Sonic, rent, Netflix…'} autoComplete="off" onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <AnimatePresence>
        {sensitive && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="rounded-xl bg-warn/15 px-3 py-2 text-sm text-warn">
            🔒 That looks like an account or card number. Only the last 4 digits will be saved.
          </motion.p>
        )}
      </AnimatePresence>

      <Field label="Date" id="date">
        <input id="date" type="date" className={inputClass} value={date} max="2100-12-31" min="1990-01-01" onChange={(e) => setDate(e.target.value)} />
      </Field>

      <div>
        <p className="mb-1.5 text-sm font-semibold text-muted">
          Category {!touched && description && <span className="font-normal text-faint">· guessed for you</span>}
        </p>
        <CategoryPicker type={type} value={chosen} onChange={(c) => { setCategory(c); setTouched(true) }} />
        {touched && description.trim() && (
          <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-5 w-5 accent-[#3d8bff]" />
            Always use this for “{prettyMerchant(merchantKey(description))}”
          </label>
        )}
      </div>

      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
      <Button type="submit" className="w-full">{saveLabel}</Button>
      {onDelete && <Button type="button" variant="ghost" className="w-full text-bad" onClick={onDelete}>Delete</Button>}
    </form>
  )
}

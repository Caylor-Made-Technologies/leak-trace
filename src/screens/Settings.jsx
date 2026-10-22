import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useApp } from '../state.jsx'
import { Button, Field, Segmented, Sheet, inputClass } from '../components/ui.jsx'
import { LockIcon } from '../components/icons.jsx'
import Policy from '../components/Policy.jsx'
import { db, setSetting, wipeEverything, getRules } from '../db.js'
import { buildBackup, cleanBackup, decryptBackup, encryptBackup, readBackupText, MAX_BACKUP_BYTES } from '../lib/backup.js'
import { toCsv } from '../lib/csv.js'
import { parseAmount, formatMoney } from '../lib/money.js'
import { todayISO } from '../lib/dates.js'

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export default function Settings({ open, onClose }) {
  const { theme, setTheme, settings, txns, showToast } = useApp()
  const [wage, setWage] = useState(settings.hourlyWage ? (settings.hourlyWage / 100).toFixed(2) : '')
  const demoCount = txns.filter((t) => t.source === 'demo').length

  return (
    <Sheet open={open} onClose={onClose} title="Settings & privacy" full>
      <div className="space-y-6 pb-6">
        <Section title="Look">
          <Segmented label="Theme" value={theme} onChange={setTheme} options={[{ value: 'system', label: 'Auto' }, { value: 'dark', label: '🌙 Dark' }, { value: 'light', label: '☀️ Light' }]} />
          <Toggle label="Hide amounts when I leave the app" hint="Blurs numbers in the app switcher." checked={settings.autoHide !== false} onChange={(v) => setSetting('autoHide', v)} />
        </Section>

        <Section title="Hours of work">
          <Field label="Your take-home pay per hour (optional)" hint="Shows leaks as hours of work, like “6 hours of work a month.” Stays on this phone." id="wage">
            <div className="flex gap-2">
              <input id="wage" inputMode="decimal" placeholder="$18.50" className={inputClass} value={wage} onChange={(e) => setWage(e.target.value.replace(/[^0-9.]/g, '').slice(0, 8))} />
              <Button variant="ghost" onClick={async () => { const c = parseAmount(wage); await setSetting('hourlyWage', c && c > 0 ? c : null); showToast(c ? `Saved ${formatMoney(c)}/hr` : 'Cleared') }}>Save</Button>
            </div>
          </Field>
        </Section>

        <Section title="Backup">
          <p className="text-sm text-muted">Your data only lives on this phone. Save a backup file so you don’t lose it if you clear your browser or get a new phone.</p>
          <BackupExport />
          <BackupImport />
          <Button variant="ghost" className="w-full" onClick={() => { download(`money-leak-finder-${todayISO()}.csv`, toCsv(txns), 'text/csv'); showToast('Spreadsheet saved') }} disabled={!txns.length}>Export spreadsheet (CSV)</Button>
        </Section>

        <Section title="Your data">
          {demoCount > 0 && (
            <Button variant="ghost" className="w-full" onClick={async () => { await db.transactions.where('source').equals('demo').delete(); showToast('Sample data removed') }}>
              Remove sample data ({demoCount})
            </Button>
          )}
          <DeleteAll />
        </Section>

        <Section title="Privacy & terms">
          <Policy />
        </Section>

        <footer className="space-y-1 text-center text-xs text-faint">
          <p>Money Leak Finder v1.1 · Free. No ads, no in-app purchases, no subscriptions.</p>
          <p>Caylor Made Technologies · Hereford, TX 79045</p>
          <p><a className="text-accent underline" href="tel:+18067051950">(806) 705-1950</a> · <a className="text-accent underline" href="mailto:jonathoncaylor2@gmail.com">jonathoncaylor2@gmail.com</a></p>
        </footer>
      </div>
    </Sheet>
  )
}

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-faint">{title}</h3>
      {children}
    </section>
  )
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex min-h-12 items-center gap-3">
      <span className="flex-1"><span className="block text-sm font-semibold">{label}</span>{hint && <span className="block text-xs text-faint">{hint}</span>}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className={`relative h-8 w-14 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-2 ${checked ? 'bg-brand' : 'bg-line-2'}`} aria-hidden="true">
        <motion.span className="absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow" animate={{ x: checked ? 24 : 0 }} transition={{ type: 'spring', stiffness: 600, damping: 35 }} />
      </span>
    </label>
  )
}

function BackupExport() {
  const { showToast } = useApp()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async () => {
    if (pw && pw.length < 8) return showToast('Use at least 8 characters for the password')
    setBusy(true)
    try {
      const data = buildBackup({
        transactions: await db.transactions.toArray(),
        goals: await db.goals.toArray(),
        merchantRules: await getRules(),
        settings: { hourlyWage: (await db.settings.get('hourlyWage'))?.value ?? null, plugged: (await db.settings.get('plugged'))?.value ?? [] },
      })
      const out = pw ? await encryptBackup(data, pw) : data
      download(`money-leak-finder-backup-${todayISO()}${pw ? '-locked' : ''}.json`, JSON.stringify(out), 'application/json')
      await setSetting('lastBackup', Date.now())
      setPw('')
      showToast(pw ? '🔒 Locked backup saved' : 'Backup saved')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="rounded-2xl border border-line bg-card p-3 space-y-2">
      <Field label="Lock it with a password (recommended)" hint="Encrypted on this phone (AES-256). If you forget the password, the backup can’t be opened." id="bpw">
        <input id="bpw" type="password" autoComplete="new-password" className={inputClass} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Optional, 8+ characters" />
      </Field>
      <Button className="w-full" onClick={run} disabled={busy}><LockIcon size={18} /> {busy ? 'Saving…' : 'Save backup file'}</Button>
    </div>
  )
}

function BackupImport() {
  const { showToast } = useApp()
  const input = useRef(null)
  const [pending, setPending] = useState(null) // { file } when a password is needed
  const [data, setData] = useState(null)
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')

  const onFile = async (f) => {
    setError('')
    if (!f) return
    if (f.size > MAX_BACKUP_BYTES) return setError('That file is too big.')
    try {
      const r = readBackupText(await f.text())
      if (r.needsPassword) setPending(r.file)
      else setData(r.data)
    } catch (e) {
      setError(e.message)
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  const unlock = async () => {
    setError('')
    try {
      setData(cleanBackup(await decryptBackup(pending, pw)))
      setPending(null)
      setPw('')
    } catch (e) {
      setError(e.message)
    }
  }

  const restore = async (replace) => {
    await db.transaction('rw', db.transactions, db.goals, db.rules, db.settings, async () => {
      if (replace) await Promise.all([db.transactions.clear(), db.goals.clear(), db.rules.clear()])
      await db.transactions.bulkAdd(data.transactions)
      await db.goals.bulkAdd(data.goals)
      await db.rules.bulkPut(Object.entries(data.merchantRules).map(([merchant, category]) => ({ merchant, category })))
      if (data.settings.hourlyWage) await db.settings.put({ key: 'hourlyWage', value: data.settings.hourlyWage })
      if (data.settings.plugged) await db.settings.put({ key: 'plugged', value: data.settings.plugged })
    })
    showToast(`Restored ${data.transactions.length} transactions`)
    setData(null)
  }

  return (
    <div className="space-y-2">
      <input ref={input} id="restore" type="file" accept=".json,application/json" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      <label htmlFor="restore" className="flex min-h-12 w-full cursor-pointer items-center justify-center rounded-2xl border border-line bg-card-2 px-4 font-semibold">Restore from a backup</label>
      <AnimatePresence>
        {pending && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
            <label htmlFor="upw" className="block text-sm font-semibold">🔒 This backup is locked. Enter its password.</label>
            <div className="flex gap-2">
              <input id="upw" type="password" autoComplete="current-password" className={inputClass} value={pw} onChange={(e) => setPw(e.target.value)} />
              <Button onClick={unlock} disabled={!pw}>Unlock</Button>
            </div>
          </motion.div>
        )}
        {data && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden rounded-2xl bg-card-2 p-3 text-sm">
            <p className="font-semibold">Found {data.transactions.length} transactions and {data.goals.length} goals.{data.skipped ? ` ${data.skipped} damaged rows skipped.` : ''}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => restore(false)}>Add to mine</Button>
              <Button onClick={() => restore(true)}>Replace mine</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
    </div>
  )
}

function DeleteAll() {
  const [step, setStep] = useState(0)
  const [text, setText] = useState('')
  return (
    <div className="rounded-2xl border border-bad/40 p-3">
      {step === 0 ? (
        <Button variant="ghost" className="w-full text-bad" onClick={() => setStep(1)}>Delete all my data</Button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm">This erases every transaction, goal and setting from this phone. It can’t be undone. Save a backup first if you might want it.</p>
          <label htmlFor="confirmDel" className="block text-sm font-semibold">Type DELETE to confirm</label>
          <input id="confirmDel" className={inputClass} value={text} onChange={(e) => setText(e.target.value)} autoCapitalize="characters" autoComplete="off" />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => { setStep(0); setText('') }}>Cancel</Button>
            <Button variant="danger" disabled={text.trim().toUpperCase() !== 'DELETE'} onClick={async () => { await wipeEverything(); location.replace(location.pathname) }}>Erase everything</Button>
          </div>
        </div>
      )}
    </div>
  )
}

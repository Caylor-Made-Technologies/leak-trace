import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useApp } from '../state.jsx'
import { Button, Card, Confetti, Empty, Field, Money, ProgressRing, Segmented, Sheet, inputClass, haptic } from '../components/ui.jsx'
import { GrowthChart } from '../components/charts.jsx'
import { PlusIcon, TrendIcon } from '../components/icons.jsx'
import { db, saveGoal } from '../db.js'
import { GOAL_PRESETS, dateAfterMonths, describeMonths, goalPlan } from '../lib/goals.js'
import { RATES, YEARS, growthCurve, growthTable } from '../lib/invest.js'
import { formatMoney, parseAmount } from '../lib/money.js'
import { addMonths, currentMonth, isValidISO, todayISO } from '../lib/dates.js'

export default function Plan() {
  const [view, setView] = useState('goals')
  return (
    <div className="space-y-4">
      <Segmented label="Plan" value={view} onChange={setView} options={[{ value: 'goals', label: '🎯 Goals' }, { value: 'invest', label: '📈 Invest' }]} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}>
          {view === 'goals' ? <Goals /> : <Invest />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Goals() {
  const { goals, leftover, pluggedSavings, leaks, showToast } = useApp()
  const [editing, setEditing] = useState(null) // null | 'new' | goal
  const [party, setParty] = useState(false)
  const allLeaks = leaks.reduce((s, l) => s + l.savable, 0)
  const plugs = pluggedSavings || allLeaks

  return (
    <div className="space-y-3">
      <Card className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden="true">💪</span>
        <div className="flex-1 text-sm">
          <p className="text-muted">Typical money left over</p>
          <p className={`font-display text-2xl font-extrabold ${leftover < 0 ? 'text-bad' : ''}`}><Money cents={leftover} />/mo</p>
          {plugs > 0 && <p className="text-xs text-good">+<span className="money">{formatMoney(plugs, { whole: true })}</span>/mo if you plug {pluggedSavings ? 'the leaks you picked' : 'your top leaks'}</p>}
        </div>
      </Card>

      {!goals.length && (
        <Card>
          <Empty emoji="🎯" title="What are you saving for?">Pick a goal and I’ll show how much to save each week.</Empty>
        </Card>
      )}

      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {goals.map((g, i) => <GoalCard key={g.id} goal={g} index={i} leftover={leftover} plugs={plugs} pickedPlugs={!!pluggedSavings} onEdit={() => setEditing(g)} onWin={() => setParty(true)} showToast={showToast} />)}
        </AnimatePresence>
      </ul>

      <Button className="w-full" onClick={() => setEditing('new')}><PlusIcon size={20} /> New goal</Button>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'New goal' : 'Edit goal'}>
        {editing && <GoalForm goal={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      </Sheet>
      <Confetti show={party} onDone={() => setParty(false)} />
    </div>
  )
}

function GoalCard({ goal, index, leftover, plugs, pickedPlugs, onEdit, onWin, showToast }) {
  const [extra, setExtra] = useState(0)
  const [adding, setAdding] = useState('')
  const plan = goalPlan(goal, { leftover: leftover + extra * 100, plugged: plugs })
  const pct = Math.round(plan.progress * 100)

  const addMoney = async (e) => {
    e.preventDefault()
    const c = Math.abs(parseAmount(adding) || 0)
    if (!c) return
    const saved = Math.min(goal.target, (goal.saved || 0) + c)
    await db.goals.update(goal.id, { saved })
    setAdding('')
    haptic(15)
    if (saved >= goal.target) { onWin(); showToast(`🎉 ${goal.name} fully funded!`) }
    else showToast(`+${formatMoney(c, { whole: true })} toward ${goal.name}`)
  }

  return (
    <motion.li layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 300, damping: 28, delay: index * 0.05 }} className="rounded-3xl border border-line bg-card p-4 shadow-card">
      <div className="flex items-center gap-3">
        <ProgressRing value={plan.progress} size={68}><span className="text-xl" aria-hidden="true">{goal.emoji}</span></ProgressRing>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg font-bold">{goal.name}</h2>
          <p className="text-sm text-muted"><span className="money font-semibold text-ink">{formatMoney(goal.saved || 0, { whole: true })}</span> of <span className="money">{formatMoney(goal.target, { whole: true })}</span> · {pct}%</p>
          {goal.targetDate && <p className="text-xs text-faint">By {new Date(goal.targetDate + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
        </div>
        <button onClick={onEdit} className="min-h-11 px-2 text-sm font-semibold text-accent">Edit</button>
      </div>

      {plan.done ? (
        <p className="mt-3 rounded-2xl bg-good/15 p-3 text-center font-bold text-good">🎉 Done! You did it.</p>
      ) : (
        <>
          {plan.perWeek != null && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-card-2 p-3">
                <p className="text-xs text-faint">Save per week</p>
                <p className="font-display text-xl font-extrabold"><Money cents={plan.perWeek} /></p>
              </div>
              <div className="rounded-2xl bg-card-2 p-3">
                <p className="text-xs text-faint">Save per month</p>
                <p className="font-display text-xl font-extrabold"><Money cents={plan.perMonth} /></p>
              </div>
            </div>
          )}
          {plan.perMonth != null && (
            <p className={`mt-2 text-sm font-semibold ${plan.onTrack ? 'text-good' : 'text-warn'}`}>
              {plan.onTrack ? '✅ Your leftover covers this. You’re on track.' : `⚠️ That’s more than you usually have left (${formatMoney(Math.max(0, leftover + extra * 100), { whole: true })}/mo).`}
            </p>
          )}
          <div className="mt-3 space-y-1.5 text-sm">
            <Timeline label="At your current leftover" months={plan.monthsAtCurrent} tone="muted" />
            {plugs > 0 && <Timeline label={pickedPlugs ? 'With the leaks you plugged' : 'If you plug your top leaks'} months={plan.monthsWithPlugs} tone="good" />}
            {plugs > 0 && plan.monthsSaved != null && plan.monthsSaved >= 0.23 && (
              <motion.p initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-xl bg-good/15 px-3 py-2 font-semibold text-good">
                🚀 {describeMonths(plan.monthsSaved)} sooner
              </motion.p>
            )}
            {plugs > 0 && plan.monthsAtCurrent == null && plan.monthsWithPlugs != null && (
              <p className="rounded-xl bg-good/15 px-3 py-2 font-semibold text-good">🚀 Plugging leaks is what makes this possible.</p>
            )}
          </div>

          <div className="mt-3 rounded-2xl bg-card-2 p-3">
            <label htmlFor={`extra-${goal.id}`} className="flex justify-between text-sm"><span className="text-muted">What if I saved extra?</span><span className="money font-bold tnum">+${extra}/mo</span></label>
            <input id={`extra-${goal.id}`} type="range" min="0" max="1000" step="25" value={extra} onChange={(e) => setExtra(+e.target.value)} className="w-full" />
          </div>

          <form onSubmit={addMoney} className="mt-3 flex gap-2">
            <label htmlFor={`add-${goal.id}`} className="sr-only">Add money saved toward {goal.name}</label>
            <input id={`add-${goal.id}`} inputMode="decimal" placeholder="Saved some? $" value={adding} onChange={(e) => setAdding(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 10))} className={`${inputClass} flex-1`} />
            <Button type="submit" disabled={!adding}>Add</Button>
          </form>
        </>
      )}
    </motion.li>
  )
}

function Timeline({ label, months, tone }) {
  return (
    <p className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className={`text-right font-bold ${tone === 'good' ? 'text-good' : ''}`}>
        {describeMonths(months)}{months ? <span className="block text-xs font-normal text-faint">≈ {dateAfterMonths(months)}</span> : null}
      </span>
    </p>
  )
}

function GoalForm({ goal, onDone }) {
  const [name, setName] = useState(goal?.name || '')
  const [emoji, setEmoji] = useState(goal?.emoji || '🎯')
  const [target, setTarget] = useState(goal ? String(goal.target / 100) : '')
  const [saved, setSaved] = useState(goal ? String((goal.saved || 0) / 100) : '')
  const [date, setDate] = useState(goal?.targetDate || addMonths(currentMonth(), 12) + '-01')
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const t = parseAmount(target)
    if (!name.trim()) return setError('Give your goal a name.')
    if (!t || t <= 0) return setError('Enter how much you need.')
    if (date && (!isValidISO(date) || date <= todayISO())) return setError('Pick a date in the future.')
    try {
      await saveGoal({ name, emoji, target: Math.abs(t), saved: Math.abs(parseAmount(saved) || 0), targetDate: date || null, createdAt: goal?.createdAt }, goal?.id)
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-2" noValidate>
      {!goal && (
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {GOAL_PRESETS.map((p) => (
            <motion.button type="button" key={p.name} whileTap={{ scale: 0.92 }} onClick={() => { setName(p.name); setEmoji(p.emoji); setTarget(String(p.target / 100)) }} className={`flex min-h-20 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center text-xs font-semibold ${name === p.name ? 'border-brand-2 bg-brand/20' : 'border-line bg-card'}`}>
              <span className="text-2xl" aria-hidden="true">{p.emoji}</span>{p.name}
            </motion.button>
          ))}
        </div>
      )}
      <Field label="Goal name" id="gname"><input id="gname" className={inputClass} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Emergency fund" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target amount" id="gtarget"><input id="gtarget" inputMode="decimal" className={inputClass} value={target} onChange={(e) => setTarget(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 12))} placeholder="$5,000" /></Field>
        <Field label="Saved so far" id="gsaved"><input id="gsaved" inputMode="decimal" className={inputClass} value={saved} onChange={(e) => setSaved(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 12))} placeholder="$0" /></Field>
      </div>
      <Field label="Target date" id="gdate"><input id="gdate" type="date" className={inputClass} value={date || ''} min={todayISO()} max="2100-12-31" onChange={(e) => setDate(e.target.value)} /></Field>
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
      <Button type="submit" className="w-full">{goal ? 'Save' : 'Create goal'}</Button>
      {goal && <Button type="button" variant="ghost" className="w-full text-bad" onClick={async () => { await db.goals.delete(goal.id); onDone() }}>Delete goal</Button>}
    </form>
  )
}

function Invest() {
  const { leftover } = useApp()
  const suggested = Math.max(25, Math.min(2000, Math.round(Math.max(0, leftover) / 100 / 2 / 25) * 25 || 100))
  const [monthly, setMonthly] = useState(suggested)
  const cents = monthly * 100
  const table = useMemo(() => growthTable(cents), [cents])
  const curve = useMemo(() => growthCurve(cents), [cents])
  const best30 = table[table.length - 1].values[1].value

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-2 text-sm font-semibold text-muted"><TrendIcon size={18} className="text-accent" /> If you invest every month</div>
        <p className="mt-1 font-display text-4xl font-extrabold tnum"><span className="money">${monthly.toLocaleString()}</span><span className="text-lg text-faint">/mo</span></p>
        <label htmlFor="investAmt" className="sr-only">Monthly amount to invest</label>
        <input id="investAmt" type="range" min="25" max="2000" step="25" value={monthly} onChange={(e) => setMonthly(+e.target.value)} className="mt-2 w-full" />
        <div className="mt-1 flex flex-wrap gap-2">
          {[50, 100, 250, 500].map((v) => (
            <button key={v} onClick={() => { haptic(); setMonthly(v) }} className={`min-h-10 rounded-full border px-3 text-sm ${monthly === v ? 'border-brand-2 bg-brand/20' : 'border-line bg-card-2 text-muted'}`}>${v}</button>
          ))}
          {leftover > 0 && <button onClick={() => setMonthly(suggested)} className="min-h-10 rounded-full border border-line bg-card-2 px-3 text-sm text-muted">Half my leftover</button>}
        </div>
        <motion.p key={best30} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-2xl bg-brand/15 p-3 text-sm">
          At a 7% example return, that could grow to about <span className="money font-bold text-accent">{formatMoney(best30, { whole: true })}</span> in 30 years. You’d put in <span className="money font-semibold">{formatMoney(cents * 360, { whole: true })}</span>.
        </motion.p>
      </Card>

      <Card>
        <h2 className="mb-1 font-display font-bold">Growth over time</h2>
        <GrowthChart data={curve} rates={RATES} />
      </Card>

      <Card>
        <h2 className="mb-2 font-display font-bold">What it could be worth</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tnum">
            <caption className="sr-only">Estimated value at 4, 7 and 10 percent yearly returns</caption>
            <thead>
              <tr className="text-left text-xs text-faint">
                <th scope="col" className="py-1.5 font-semibold">Years</th>
                <th scope="col" className="py-1.5 text-right font-semibold">Put in</th>
                {RATES.map((r) => <th scope="col" key={r} className="py-1.5 text-right font-semibold">{Math.round(r * 100)}%</th>)}
              </tr>
            </thead>
            <tbody>
              {table.map((row) => (
                <tr key={row.years} className="border-t border-line">
                  <th scope="row" className="py-2.5 text-left font-semibold">{row.years}</th>
                  <td className="money py-2.5 text-right text-muted">{fmtK(row.contributed)}</td>
                  {row.values.map((v) => <td key={v.rate} className="money py-2.5 text-right font-semibold">{fmtK(v.value)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="rounded-2xl border border-warn/40 bg-warn/10 p-3 text-xs text-muted">
        <strong className="text-warn">Educational only, not financial advice.</strong> These are example rates, not predictions. Real investments go up and down, can lose money, and returns are never guaranteed. Fees, taxes and inflation aren’t included. Consider building an emergency fund and paying off high-interest debt first, and talk to a licensed professional before investing.
      </p>
    </div>
  )
}

const fmtK = (c) => {
  const d = c / 100
  return d >= 1_000_000 ? `$${(d / 1_000_000).toFixed(2)}M` : d >= 10_000 ? `$${Math.round(d / 1000)}k` : formatMoney(c, { whole: true })
}

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useApp } from '../state.jsx'
import { Card, Confetti, Empty, Money, haptic, spring } from '../components/ui.jsx'
import MonthSwitcher from '../components/MonthSwitcher.jsx'
import { CheckIcon, ChevronDown, WrenchIcon } from '../components/icons.jsx'
import { formatMoney } from '../lib/money.js'
import { equivalents, hoursOfWork } from '../lib/insights.js'
import PipeRun from '../three/PipeRun.jsx'

const KIND_LABEL = { subscriptions: 'Recurring', duplicate: 'Double charge', small: 'Adds up', jump: 'Jumped', fees: 'Fees' }

export default function Leaks({ go, openAdd }) {
  const { txns, leaks, plugged, togglePlug, pluggedSavings, settings } = useApp()
  const [party, setParty] = useState(false)
  const [focusId, setFocusId] = useState(null)
  const yearly = leaks.filter((l) => !plugged.has(l.id)).reduce((s, l) => s + l.yearly, 0)
  const open = leaks.filter((l) => !plugged.has(l.id))
  const done = leaks.filter((l) => plugged.has(l.id))

  const plug = async (id) => {
    const nowPlugged = await togglePlug(id)
    if (nowPlugged) { haptic([10, 40, 20]); setParty(true) }
  }

  if (!txns.length) {
    return (
      <Card>
        <Empty emoji="🔍" title="No leaks to find yet">
          Add a month of spending and I’ll show where it’s slipping away.
          <div><button className="mt-2 min-h-11 font-semibold text-accent" onClick={() => openAdd()}>Add transactions</button></div>
        </Empty>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <MonthSwitcher />
      <LeakMeter yearly={yearly} count={open.length} saved={pluggedSavings} open={open} focusId={focusId} />

      {!leaks.length && (
        <Card>
          <Empty emoji="🛡️" title="No leaks this month">Nice and tight. Keep it up, or look at another month.</Empty>
        </Card>
      )}

      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {open.map((l, i) => <LeakCard key={l.id} leak={l} index={i} hourly={settings.hourlyWage} onPlug={() => plug(l.id)} onFocus={() => setFocusId(l.id)} />)}
        </AnimatePresence>
      </ul>

      {done.length > 0 && (
        <section>
          <h2 className="mb-2 mt-2 px-1 font-display font-bold">Plugged 🔧</h2>
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {done.map((l) => (
                <motion.li key={l.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex items-center gap-3 rounded-2xl border border-good/30 bg-good/10 p-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-good text-white"><CheckIcon size={20} /></span>
                  <span className="flex-1 text-sm"><span className="font-semibold">{l.title}</span><span className="block text-muted">Saves about <span className="money">{formatMoney(l.savable, { whole: true })}</span>/month</span></span>
                  <button className="min-h-11 px-2 text-sm font-semibold text-accent" onClick={() => togglePlug(l.id)}>Undo</button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <button onClick={() => go('plan')} className="mt-3 w-full rounded-2xl bg-brand/15 p-3 text-sm font-semibold text-accent">See how much faster your goals go →</button>
        </section>
      )}
      <Confetti show={party} onDone={() => setParty(false)} />
    </div>
  )
}

function LeakMeter({ yearly, count, saved, open, focusId }) {
  const focus = open.find((l) => l.id === focusId) ?? (open.length ? open.reduce((a, b) => (b.yearly > a.yearly ? b : a)) : null)
  return (
    <Card className="relative overflow-hidden">
      <PipeRun leaks={open} focusId={focus?.id ?? null} />
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted">{count ? 'Slipping away, per year' : 'All leaks plugged'}</p>
          <p className="font-display text-4xl font-extrabold tracking-tight text-ink"><Money cents={yearly} /></p>
          <p className="mt-1 text-sm text-muted">{count} open leak{count === 1 ? '' : 's'} this month</p>
        </div>
        {focus && (
          <p className="max-w-[45%] text-right text-sm"><span className="block text-xs font-bold uppercase tracking-wider text-warn">Lit up</span><span className="font-semibold">{focus.title}</span></p>
        )}
      </div>
      {saved > 0 && (
        <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-good/15 px-2.5 py-1 text-xs font-bold text-good">
          🔧 Plugged: +<Money cents={saved} />/mo
        </p>
      )}
    </Card>
  )
}

function LeakCard({ leak: l, index, hourly, onPlug, onFocus }) {
  const [openDetails, setOpen] = useState(false)
  const eq = equivalents(l.yearly)
  const hours = hoursOfWork(l.monthly, hourly)
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 80, scale: 0.9, transition: { duration: 0.25 } }}
      transition={{ ...spring, delay: index * 0.05 }}
      className="rounded-3xl border border-line bg-card p-4 shadow-card"
    >
      <div className="flex items-start gap-3">
        <motion.span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-card-2 text-2xl" whileHover={{ rotate: [0, -10, 10, 0] }} aria-hidden="true">{l.emoji}</motion.span>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent">{KIND_LABEL[l.kind]}</span>
          <h2 className="font-bold leading-snug">{l.title}</h2>
        </div>
      </div>
      <p className="mt-3 text-[15px]">
        You spent <span className="money font-bold">{formatMoney(l.monthly, { whole: true })}</span> {l.kind === 'jump' ? 'more than last month' : 'this month'}, about <span className="money font-bold text-bad">{formatMoney(l.yearly, { whole: true })}</span> per year.
      </p>
      {(eq.length > 0 || hours) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {hours && <span className="rounded-full bg-card-2 px-2.5 py-1 text-xs text-muted">⏱️ {hours} a month</span>}
          {eq.map((e) => <span key={e} className="rounded-full bg-card-2 px-2.5 py-1 text-xs text-muted">= {e} a year</span>)}
        </div>
      )}
      <p className="mt-2 text-sm text-muted">{l.detail}</p>

      {l.items.length > 0 && (
        <>
          <button onClick={() => { setOpen((o) => !o); onFocus?.() }} aria-expanded={openDetails} className="mt-1 flex min-h-11 items-center gap-1 text-sm font-semibold text-accent">
            {openDetails ? 'Hide' : 'Show'} details
            <motion.span animate={{ rotate: openDetails ? 180 : 0 }}><ChevronDown size={18} /></motion.span>
          </button>
          <AnimatePresence initial={false}>
            {openDetails && (
              <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                {l.items.map((it, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 border-t border-line py-2 text-sm">
                    <span className="min-w-0"><span className="block truncate font-medium">{it.label}</span>{it.note && <span className="text-xs text-faint">{it.note}</span>}</span>
                    <span className="money tnum shrink-0 font-semibold">{formatMoney(it.amount)}</span>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </>
      )}

      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onPlug}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-brand-2 font-bold text-white"
      >
        <WrenchIcon size={20} /> <span>Plug it · save ~<span className="money">{formatMoney(l.savable, { whole: true })}</span>/mo</span>
      </motion.button>
    </motion.li>
  )
}

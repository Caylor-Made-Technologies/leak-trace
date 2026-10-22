import { useMemo } from 'react'
import { motion } from 'motion/react'
import { useApp } from '../state.jsx'
import { Button, Card, Money } from '../components/ui.jsx'
import MonthSwitcher from '../components/MonthSwitcher.jsx'
import { CategoryBars, GroupDonut, IncomeSpendingChart } from '../components/charts.jsx'
import { CameraIcon, FileIcon, PenIcon, ShieldIcon, SparkIcon } from '../components/icons.jsx'
import { byCategory, byGroup, inMonth, monthlySeries, totals } from '../lib/stats.js'
import { suggestions } from '../lib/insights.js'
import { upcomingCharges } from '../lib/leaks.js'
import { cat } from '../lib/categories.js'
import { currentMonth, friendlyDate, todayISO } from '../lib/dates.js'
import { addTransactions } from '../db.js'
import { demoTransactions } from '../lib/demo.js'
import { formatMoney } from '../lib/money.js'
import TxnRow from '../components/TxnRow.jsx'
import Logo from '../components/Logo.jsx'

export default function Home({ go, openAdd }) {
  const { txns, loading, month, leaks, goals, leftover, showToast } = useApp()
  const monthTxns = useMemo(() => inMonth(txns, month), [txns, month])
  const t = useMemo(() => totals(monthTxns), [monthTxns])
  const cats = useMemo(() => byCategory(monthTxns), [monthTxns])
  const groups = useMemo(() => byGroup(monthTxns), [monthTxns])
  const series = useMemo(() => {
    const all = monthlySeries(txns, month, 6)
    const first = all.findIndex((m) => m.income || m.spending)
    return all.slice(Math.min(Math.max(0, first), all.length - 2))
  }, [txns, month])
  const tips = useMemo(() => suggestions({ txns, month, leaks, goals, leftover }), [txns, month, leaks, goals, leftover])
  const leakYear = leaks.reduce((s, l) => s + l.yearly, 0)
  const upcoming = useMemo(() => (month === currentMonth() ? upcomingCharges(txns, todayISO()) : []), [txns, month])

  if (loading) return <div className="h-64 animate-pulse rounded-3xl bg-card" aria-label="Loading" />

  if (!txns.length) {
    return (
      <div className="space-y-4">
        <Card className="relative overflow-hidden text-center">
          <div className="mx-auto mt-1 mb-2 flex justify-center drop-shadow-[0_10px_30px_rgba(61,139,255,0.35)]"><Logo size={132} tile={false} title="Money Leak Finder logo" /></div>
          <h2 className="font-display text-2xl font-extrabold">Find where your money slips away</h2>
          <p className="mx-auto mt-2 max-w-xs text-muted">Add your pay and spending. We'll spot the leaks and show how fast you can hit your goals.</p>
          <div className="mt-5 grid gap-2.5">
            <Button onClick={() => openAdd('screenshot')}><CameraIcon size={20} /> Read screenshots</Button>
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="ghost" onClick={() => openAdd('csv')}><FileIcon size={20} /> Bank CSV</Button>
              <Button variant="ghost" onClick={() => openAdd('manual')}><PenIcon size={20} /> Type it in</Button>
            </div>
            <Button variant="plain" onClick={async () => { const n = await addTransactions(demoTransactions()); showToast(`Loaded ${n} sample transactions`) }}>
              <SparkIcon size={18} /> Try it with sample data
            </Button>
          </div>
        </Card>
        <Card className="flex gap-3">
          <ShieldIcon size={28} className="mt-0.5 shrink-0 text-good" />
          <div className="text-sm">
            <p className="font-semibold">Your data stays on this phone</p>
            <p className="mt-0.5 text-muted">No bank logins, no account numbers, no ads, no trackers. Card and account numbers are hidden automatically.</p>
          </div>
        </Card>
      </div>
    )
  }

  const spentPct = t.income ? Math.min(100, Math.round((t.spending / t.income) * 100)) : 0
  const positive = t.left >= 0

  return (
    <div className="space-y-4">
      <MonthSwitcher />

      <Card className="relative overflow-hidden">
        <div className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl ${positive ? 'bg-brand-2/30' : 'bg-bad/25'}`} />
        <p className="text-sm font-semibold text-muted">Left over this month</p>
        <p className={`mt-1 font-display text-5xl font-extrabold tracking-tight ${positive ? '' : 'text-bad'}`}>
          <Money cents={t.left} />
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card-2 p-3">
            <p className="text-xs text-faint">Money in</p>
            <p className="text-lg font-bold text-good"><Money cents={t.income} /></p>
          </div>
          <div className="rounded-2xl bg-card-2 p-3">
            <p className="text-xs text-faint">Money out</p>
            <p className="text-lg font-bold"><Money cents={t.spending} /></p>
          </div>
        </div>
        {t.income > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-faint"><span>Spent {spentPct}% of income</span><span>{100 - spentPct}% left</span></div>
            <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-card-2" role="progressbar" aria-valuenow={spentPct} aria-valuemin={0} aria-valuemax={100} aria-label="Share of income spent">
              <motion.div
                className={`h-full rounded-full ${spentPct > 95 ? 'bg-bad' : spentPct > 80 ? 'bg-warn' : 'bg-gradient-to-r from-brand to-brand-2'}`}
                initial={{ width: 0 }} animate={{ width: `${spentPct}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        )}
      </Card>

      {leaks.length > 0 && (
        <motion.button
          onClick={() => go('leaks')}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="flex w-full items-center gap-3 rounded-3xl border border-bad/40 bg-gradient-to-r from-bad/15 to-transparent p-4 text-left"
        >
          <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-bad/20 text-2xl" aria-hidden="true">
            💧<span className="drip absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-accent" />
          </span>
          <span className="flex-1">
            <span className="block font-bold">{leaks.length} leak{leaks.length > 1 ? 's' : ''} found</span>
            <span className="block text-sm text-muted">About <span className="money font-semibold text-ink">{formatMoney(leakYear, { whole: true })}</span> a year slipping away</span>
          </span>
          <span className="text-accent font-semibold text-sm">Fix →</span>
        </motion.button>
      )}

      {upcoming.length > 0 && (
        <Card>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-display font-bold">📅 Coming up</h2>
            <span className="text-xs text-faint">next 2 weeks · <span className="money">{formatMoney(upcoming.reduce((s, u) => s + u.amount, 0), { whole: true })}</span></span>
          </div>
          <ul className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1" tabIndex={0} aria-label="Upcoming charges">
            {upcoming.map((u, i) => (
              <motion.li key={u.key} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05, type: 'spring', stiffness: 400, damping: 26 }} className="w-32 shrink-0 rounded-2xl bg-card-2 p-3">
                <p className="text-xl" aria-hidden="true">{cat(u.category).emoji}</p>
                <p className="mt-1 truncate text-sm font-semibold">{u.name}</p>
                <p className="money tnum font-bold">{formatMoney(u.amount)}</p>
                <p className={`text-xs ${u.inDays <= 2 ? 'font-bold text-warn' : 'text-faint'}`}>{u.inDays === 0 ? 'Today' : u.inDays === 1 ? 'Tomorrow' : `${friendlyDate(u.next)} · ${u.inDays} days`}</p>
              </motion.li>
            ))}
          </ul>
        </Card>
      )}

      {tips.length > 0 && (
        <Card>
          <h2 className="mb-2 flex items-center gap-2 font-display font-bold"><SparkIcon size={18} className="text-accent" /> Your money story</h2>
          <ul className="space-y-2">
            {tips.map((s, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }} className="flex gap-2.5 rounded-2xl bg-card-2 p-3 text-sm">
                <span className="text-lg" aria-hidden="true">{s.emoji}</span>
                <span className="money">{s.text}</span>
              </motion.li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 font-display font-bold">Income vs. spending</h2>
        <IncomeSpendingChart data={series} />
      </Card>

      {cats.length > 0 && (
        <Card>
          <h2 className="mb-3 font-display font-bold">Needs, wants &amp; saving</h2>
          <GroupDonut groups={groups} />
        </Card>
      )}

      {cats.length > 0 && (
        <Card>
          <h2 className="mb-2 font-display font-bold">Where it went</h2>
          <CategoryBars rows={cats} onPick={() => go('activity')} />
        </Card>
      )}

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display font-bold">Recent</h2>
          <button className="min-h-11 px-2 text-sm font-semibold text-accent" onClick={() => go('activity')}>See all</button>
        </div>
        <ul className="space-y-2">
          {[...monthTxns].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 5).map((t, i) => <TxnRow key={t.id} t={t} index={i} onOpen={() => go('activity')} />)}
        </ul>
        {!monthTxns.length && <p className="py-4 text-center text-sm text-muted">Nothing this month yet.</p>}
      </Card>
    </div>
  )
}

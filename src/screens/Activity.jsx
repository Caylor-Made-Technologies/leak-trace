import { useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useApp } from '../state.jsx'
import { db, getRules, recategorize } from '../db.js'
import { Card, Chip, Empty, Sheet, inputClass } from '../components/ui.jsx'
import MonthSwitcher from '../components/MonthSwitcher.jsx'
import TxnRow from '../components/TxnRow.jsx'
import TxnForm from '../components/TxnForm.jsx'
import { SearchIcon } from '../components/icons.jsx'
import { inMonth, totals } from '../lib/stats.js'
import { cat } from '../lib/categories.js'
import { formatMoney } from '../lib/money.js'

export default function Activity({ openAdd }) {
  const { txns, month, showToast } = useApp()
  const rules = useLiveQuery(getRules, [], {})
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState(null)

  const monthTxns = useMemo(() => inMonth(txns, month), [txns, month])
  const usedCats = useMemo(() => [...new Set(monthTxns.map((t) => t.category))].map(cat), [monthTxns])
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return monthTxns
      .filter((t) => filter === 'all' || (filter === 'in' ? t.type === 'income' : filter === 'out' ? t.type === 'expense' : t.category === filter))
      .filter((t) => !needle || t.description.toLowerCase().includes(needle) || cat(t.category).label.toLowerCase().includes(needle))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  }, [monthTxns, q, filter])
  const days = useMemo(() => {
    const m = new Map()
    for (const t of list) m.set(t.date, [...(m.get(t.date) || []), t])
    return [...m]
  }, [list])
  const sum = totals(list)

  const remove = async (t) => {
    await db.transactions.delete(t.id)
    const { id, ...rest } = t
    showToast('Deleted', { label: 'Undo', run: () => db.transactions.add({ ...rest }) })
  }

  const save = async (data, { remember }) => {
    const t = editing
    await db.transactions.update(t.id, { type: data.type, amount: data.amount, description: data.description, date: data.date, category: data.category })
    if (remember && data.category !== t.category) await recategorize({ ...t, ...data }, data.category, true)
    setEditing(null)
    showToast(remember && data.category !== t.category ? 'Saved. I’ll remember that category.' : 'Saved')
  }

  return (
    <div className="space-y-3">
      <MonthSwitcher />
      <div className="relative">
        <SearchIcon size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
        <label htmlFor="search" className="sr-only">Search transactions</label>
        <input id="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className={`${inputClass} pl-11`} />
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filters">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
        <Chip active={filter === 'in'} onClick={() => setFilter('in')}>Money in</Chip>
        <Chip active={filter === 'out'} onClick={() => setFilter('out')}>Money out</Chip>
        {usedCats.map((c) => <Chip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>{c.emoji} {c.label}</Chip>)}
      </div>

      {list.length > 0 && (
        <p className="px-1 text-xs text-faint">
          {list.length} item{list.length > 1 ? 's' : ''} · in <span className="money text-good">{formatMoney(sum.income, { whole: true })}</span> · out <span className="money">{formatMoney(sum.spending, { whole: true })}</span> · swipe left to delete
        </p>
      )}

      {!list.length ? (
        <Card>
          <Empty emoji="🧾" title={monthTxns.length ? 'No matches' : 'Nothing here yet'}>
            {monthTxns.length ? 'Try a different search or filter.' : <button className="min-h-11 font-semibold text-accent" onClick={() => openAdd()}>Add your first one</button>}
          </Empty>
        </Card>
      ) : (
        days.map(([date, items]) => (
          <section key={date} aria-label={date}>
            <h2 className="mb-1.5 mt-3 px-1 text-xs font-bold uppercase tracking-wider text-faint">
              {new Date(date + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </h2>
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {items.map((t, i) => <TxnRow key={t.id} t={t} index={i} onOpen={setEditing} onDelete={remove} />)}
              </AnimatePresence>
            </ul>
          </section>
        ))
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit">
        {editing && <TxnForm initial={editing} rules={rules} onSave={save} onDelete={() => { remove(editing); setEditing(null) }} />}
      </Sheet>
    </div>
  )
}

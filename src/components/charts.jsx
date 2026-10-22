import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { motion } from 'motion/react'
import { useApp, useChartColors } from '../state.jsx'
import { formatMoney, formatShort } from '../lib/money.js'
import { shortMonth } from '../lib/dates.js'
import { GROUPS } from '../lib/categories.js'

function TipBox({ title, rows }) {
  return (
    <div className="money rounded-xl border border-line-2 bg-card-2 px-3 py-2 text-xs shadow-card">
      {title && <p className="mb-1 font-bold">{title}</p>}
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 tnum">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
          <span className="text-muted">{r.label}</span>
          <span className="ml-auto pl-3 font-semibold">{formatMoney(r.value, { whole: true })}</span>
        </p>
      ))}
    </div>
  )
}

function LegendRow({ items }) {
  return (
    <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />{i.label}
        </li>
      ))}
    </ul>
  )
}

export function IncomeSpendingChart({ data }) {
  const c = useChartColors()
  const rows = data.map((d) => ({ ...d, name: shortMonth(d.month) }))
  return (
    <figure>
      <div className="h-48" role="img" aria-label="Income and spending for the last six months">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} barGap={2} barCategoryGap="22%" margin={{ top: 6, right: 0, left: -14, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => formatShort(v)} tick={{ fill: c.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              cursor={{ fill: c.grid }}
              content={({ active, payload, label }) => active && payload?.length ? (
                <TipBox title={label} rows={[{ label: 'Income', value: payload[0].payload.income, color: c.s1 }, { label: 'Spending', value: payload[0].payload.spending, color: c.s2 }]} />
              ) : null}
            />
            <Bar dataKey="income" fill={c.s1} radius={[4, 4, 0, 0]} animationDuration={900} />
            <Bar dataKey="spending" fill={c.s2} radius={[4, 4, 0, 0]} animationDuration={900} animationBegin={150} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <LegendRow items={[{ label: 'Income', color: c.s1 }, { label: 'Spending', color: c.s2 }]} />
      <figcaption className="sr-only">
        {rows.map((r) => `${r.name}: income ${formatMoney(r.income, { whole: true })}, spending ${formatMoney(r.spending, { whole: true })}`).join('. ')}
      </figcaption>
    </figure>
  )
}

export function GroupDonut({ groups }) {
  const c = useChartColors()
  const total = groups.needs + groups.wants + groups.saving
  const data = [
    { key: 'needs', label: GROUPS.needs.label, value: groups.needs, color: c.s1 },
    { key: 'wants', label: GROUPS.wants.label, value: groups.wants, color: c.s2 },
    { key: 'saving', label: GROUPS.saving.label, value: groups.saving, color: c.s3 },
  ]
  if (!total) return null
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-36 w-36 shrink-0" role="img" aria-label="Spending split between needs, wants and saving">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data.filter((d) => d.value > 0)} dataKey="value" nameKey="label" innerRadius="66%" outerRadius="100%" paddingAngle={2} stroke={c.surface} strokeWidth={2} cornerRadius={4} animationDuration={900}>
              {data.filter((d) => d.value > 0).map((d) => <Cell key={d.key} fill={d.color} />)}
            </Pie>
            <Tooltip content={({ active, payload }) => active && payload?.length ? <TipBox rows={[{ label: payload[0].name, value: payload[0].value, color: payload[0].payload.color }]} /> : null} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[11px] text-faint">Spent</p>
            <p className="money tnum text-sm font-bold">{formatShort(total)}</p>
          </div>
        </div>
      </div>
      <ul className="flex-1 space-y-2.5">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2 text-sm">
            <span className="inline-block h-3 w-3 shrink-0 rounded-[4px]" style={{ background: d.color }} />
            <span className="flex-1">
              <span className="font-semibold">{d.label}</span>
              <span className="block text-xs text-faint">{GROUPS[d.key].hint}</span>
            </span>
            <span className="text-right tnum">
              <span className="money block font-semibold">{formatMoney(d.value, { whole: true })}</span>
              <span className="text-xs text-faint">{Math.round((d.value / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Spending by category: one bar per category, longest first.
export function CategoryBars({ rows, onPick }) {
  const max = Math.max(1, ...rows.map((r) => r.total))
  return (
    <ul className="space-y-1">
      {rows.map((r, i) => (
        <motion.li key={r.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 28 }}>
          <button onClick={() => onPick?.(r)} className="w-full rounded-xl px-1 py-1.5 text-left hover:bg-card-2">
            <span className="flex items-center gap-2 text-sm">
              <span className="w-6 text-center text-lg" aria-hidden="true">{r.emoji}</span>
              <span className="flex-1 truncate font-medium">{r.label}</span>
              <span className="text-xs text-faint">{r.count}×</span>
              <span className="money tnum w-20 text-right font-semibold">{formatMoney(r.total, { whole: true })}</span>
            </span>
            <span className="mt-1 ml-8 block h-2 overflow-hidden rounded-full bg-card-2">
              <motion.span
                className="block h-full rounded-full bg-gradient-to-r from-brand to-brand-2"
                initial={{ width: 0 }}
                animate={{ width: `${(r.total / max) * 100}%` }}
                transition={{ duration: 0.9, delay: 0.1 + i * 0.04, ease: [0.16, 1, 0.3, 1] }}
              />
            </span>
          </button>
        </motion.li>
      ))}
    </ul>
  )
}

export function GrowthChart({ data, rates }) {
  const c = useChartColors()
  const colors = [c.s1, c.s2, c.s3]
  const { privacy } = useApp()
  return (
    <figure>
      <div className="h-56" role="img" aria-label="How monthly investing could grow over 30 years at different example returns">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 6, left: -8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="year" tick={{ fill: c.axis, fontSize: 11 }} axisLine={false} tickLine={false} ticks={[0, 5, 10, 20, 30]} tickFormatter={(v) => `${v}y`} />
            <YAxis tickFormatter={(v) => (privacy ? '•••' : formatShort(v))} tick={{ fill: c.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
            <Tooltip
              content={({ active, payload, label }) => active && payload?.length ? (
                <TipBox title={`Year ${label}`} rows={[
                  ...rates.map((r, i) => ({ label: `${Math.round(r * 100)}% a year`, value: payload[0].payload[`r${Math.round(r * 100)}`], color: colors[i] })),
                  { label: 'You put in', value: payload[0].payload.contributed, color: c.muted },
                ]} />
              ) : null}
            />
            <Line type="monotone" dataKey="contributed" stroke={c.muted} strokeWidth={2} strokeDasharray="4 4" dot={false} animationDuration={900} />
            {rates.map((r, i) => (
              <Line key={r} type="monotone" dataKey={`r${Math.round(r * 100)}`} stroke={colors[i]} strokeWidth={2} dot={false} animationDuration={1100} animationBegin={i * 150} />
            ))}
            <Legend content={() => <LegendRow items={[...rates.map((r, i) => ({ label: `${Math.round(r * 100)}%`, color: colors[i] })), { label: 'You put in', color: c.muted }]} />} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

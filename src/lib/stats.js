import { cat } from './categories.js'
import { addMonths, monthKey } from './dates.js'

export function inMonth(txns, month) {
  return txns.filter((t) => monthKey(t.date) === month)
}

export function totals(txns) {
  let income = 0
  let spending = 0
  for (const t of txns) {
    if (t.type === 'income') income += t.amount
    else spending += t.amount
  }
  return { income, spending, left: income - spending }
}

export function byCategory(txns) {
  const map = new Map()
  for (const t of txns) {
    if (t.type !== 'expense') continue
    const row = map.get(t.category) || { id: t.category, total: 0, count: 0 }
    row.total += t.amount
    row.count += 1
    map.set(t.category, row)
  }
  return [...map.values()]
    .map((r) => ({ ...r, ...cat(r.id), id: r.id }))
    .sort((a, b) => b.total - a.total)
}

export function byGroup(txns) {
  const g = { needs: 0, wants: 0, saving: 0 }
  for (const t of txns) {
    if (t.type !== 'expense') continue
    g[cat(t.category).group] += t.amount
  }
  return g
}

// Income vs spending for the last `count` months ending at `month`.
export function monthlySeries(txns, month, count = 6) {
  const out = []
  for (let i = count - 1; i >= 0; i--) {
    const m = addMonths(month, -i)
    out.push({ month: m, ...totals(inMonth(txns, m)) })
  }
  return out
}

export function monthsWithData(txns) {
  return [...new Set(txns.map((t) => monthKey(t.date)))].sort()
}

// Typical money left over per month: average of up to 3 recent months that have
// both income and spending. Falls back to the current month alone.
export function typicalLeftover(txns, month) {
  const months = []
  for (let i = 0; i < 6 && months.length < 3; i++) {
    const m = addMonths(month, -i)
    const t = totals(inMonth(txns, m))
    if (t.income > 0 && t.spending > 0) months.push(t)
  }
  if (!months.length) return totals(inMonth(txns, month)).left
  return Math.round(months.reduce((s, t) => s + t.left, 0) / months.length)
}

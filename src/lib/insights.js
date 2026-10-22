import { cat } from './categories.js'
import { describeMonths, monthsToReach } from './goals.js'
import { formatMoney } from './money.js'
import { addMonths } from './dates.js'
import { byCategory, inMonth, totals } from './stats.js'

const money = (c) => formatMoney(c, { whole: true })

// Plain-English suggestions for the month, most useful first.
export function suggestions({ txns, month, leaks, goals = [], leftover }) {
  const out = []
  const now = totals(inMonth(txns, month))
  const cats = byCategory(inMonth(txns, month))
  const goal = goals.find((g) => g.target > (g.saved || 0))
  const remaining = goal ? goal.target - (goal.saved || 0) : 0

  const goalLine = (extra) => {
    if (!goal || extra <= 0) return ''
    const before = monthsToReach(remaining, leftover)
    const after = monthsToReach(remaining, leftover + extra)
    if (after == null) return ''
    if (before == null) return `, which gets your ${money(goal.target)} ${goal.name.toLowerCase()} done in about ${describeMonths(after)}`
    const diff = Math.round(before - after)
    if (diff < 1) return ''
    return `, which gets your ${money(goal.target)} ${goal.name.toLowerCase()} done ${diff} month${diff > 1 ? 's' : ''} sooner`
  }

  // Halve the biggest "want" category.
  const want = cats.find((c) => c.group === 'wants' && !['fees', 'transfer', 'other'].includes(c.id) && c.total >= 5000)
  if (want) {
    const half = Math.round(want.total / 2)
    out.push({
      emoji: want.emoji,
      text: `Cutting ${want.label.toLowerCase()} in half frees up ${money(half)}/month${goalLine(half)}.`,
    })
  }

  const fees = leaks.find((l) => l.kind === 'fees')
  if (fees) out.push({ emoji: '⚠️', text: `You paid ${money(fees.monthly)} in fees and interest. That's ${money(fees.yearly)} a year for nothing. Turn on low-balance alerts and autopay.` })

  const subs = leaks.find((l) => l.kind === 'subscriptions')
  if (subs && subs.items.length >= 2) {
    const smallest = subs.items[subs.items.length - 1]
    out.push({ emoji: '🔁', text: `You have ${subs.items.length} recurring charges (${money(subs.monthly)}/month). Dropping ${smallest.label} alone saves ${money(smallest.amount * 12)} a year.` })
  }

  const plugAll = leaks.reduce((s, l) => s + l.savable, 0)
  if (plugAll > 0 && goal) {
    out.push({ emoji: '🎯', text: `Plugging your top leaks frees up about ${money(plugAll)}/month${goalLine(plugAll) || ''}.` })
  }

  const prev = totals(inMonth(txns, addMonths(month, -1)))
  if (prev.spending > 0 && now.spending > 0) {
    const diff = now.spending - prev.spending
    if (Math.abs(diff) >= 2500) {
      out.push(diff < 0
        ? { emoji: '🎉', text: `You spent ${money(-diff)} less than last month. Nice work. Move that into savings before it disappears.` }
        : { emoji: '👀', text: `Spending is up ${money(diff)} from last month.` })
    }
  }

  if (now.income > 0 && now.left < 0) {
    out.push({ emoji: '🚨', text: `You spent ${money(-now.left)} more than you made this month. Start with the biggest leak below.` })
  } else if (now.income > 0 && now.left > 0 && !goal) {
    out.push({ emoji: '🏁', text: `You have ${money(now.left)} left over. Set a goal so it has a job.` })
  }

  return out.slice(0, 5)
}

// "That's 6 hours of work" — only when the user sets an hourly wage.
export function hoursOfWork(cents, hourlyCents) {
  if (!hourlyCents || hourlyCents <= 0) return null
  const h = cents / hourlyCents
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min of work`
  return `${h < 10 ? h.toFixed(1).replace(/\.0$/, '') : Math.round(h)} hours of work`
}

// Fun real-world equivalents for a yearly amount.
export function equivalents(yearlyCents) {
  const d = yearlyCents / 100
  const list = []
  if (d >= 60) list.push(`${Math.floor(d / 60)} tanks of gas`)
  if (d >= 500) list.push(`${Math.floor(d / 500)} truck payment${d >= 1000 ? 's' : ''}`)
  if (d >= 1200) list.push(`${(d / 1200).toFixed(1).replace(/\.0$/, '')} months of rent`)
  return list.slice(0, 2)
}

export function categorySummary(id) {
  return cat(id)
}

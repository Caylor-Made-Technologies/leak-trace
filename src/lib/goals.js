import { daysBetween, todayISO } from './dates.js'

const DAYS_PER_MONTH = 30.44

// What it takes to hit a goal by its date, and how long it takes at a given pace.
export function goalPlan(goal, { leftover = 0, plugged = 0, today = todayISO() } = {}) {
  const remaining = Math.max(0, goal.target - (goal.saved || 0))
  const days = goal.targetDate ? Math.max(1, daysBetween(today, goal.targetDate)) : null
  const weeks = days ? days / 7 : null
  const months = days ? days / DAYS_PER_MONTH : null
  const perWeek = weeks ? Math.ceil(remaining / weeks) : null
  const perMonth = months ? Math.ceil(remaining / Math.max(months, 1 / DAYS_PER_MONTH)) : null

  const monthsAtCurrent = monthsToReach(remaining, leftover)
  const monthsWithPlugs = monthsToReach(remaining, leftover + plugged)
  const saved = monthsAtCurrent != null && monthsWithPlugs != null ? monthsAtCurrent - monthsWithPlugs : null

  return {
    remaining,
    progress: goal.target ? Math.min(1, (goal.saved || 0) / goal.target) : 0,
    daysLeft: days,
    perWeek,
    perMonth,
    monthsAtCurrent,
    monthsWithPlugs,
    monthsSaved: saved,
    onTrack: perMonth != null && leftover >= perMonth,
    done: remaining === 0,
  }
}

export function monthsToReach(remaining, perMonth) {
  if (remaining <= 0) return 0
  if (!perMonth || perMonth <= 0) return null
  return remaining / perMonth
}

export function describeMonths(m) {
  if (m == null) return 'never at this pace'
  if (m === 0) return 'done'
  if (m < 1) {
    const w = Math.max(1, Math.round(m * 4.35))
    return `${w} week${w > 1 ? 's' : ''}`
  }
  if (m < 6) {
    const r = Math.round(m * 10) / 10
    return `${r} month${r === 1 ? '' : 's'}`
  }
  if (m < 24) {
    const r = Math.round(m)
    return `${r} months`
  }
  const y = m / 12
  return `${y.toFixed(y < 10 ? 1 : 0)} years`
}

export function dateAfterMonths(m, from = new Date()) {
  if (m == null) return null
  const d = new Date(from)
  d.setDate(d.getDate() + Math.round(m * DAYS_PER_MONTH))
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export const GOAL_PRESETS = [
  { name: 'Emergency fund', emoji: '🛟', target: 100000 },
  { name: 'Truck', emoji: '🛻', target: 1500000 },
  { name: 'House down payment', emoji: '🏡', target: 2000000 },
  { name: 'Pay off a card', emoji: '💳', target: 300000 },
  { name: 'Vacation', emoji: '🏖️', target: 200000 },
  { name: 'New phone', emoji: '📱', target: 100000 },
]

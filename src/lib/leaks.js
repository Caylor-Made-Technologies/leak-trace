import { cat } from './categories.js'
import { merchantKey, prettyMerchant } from './categorize.js'
import { addMonths, daysBetween, monthKey } from './dates.js'
import { byCategory, inMonth } from './stats.js'

// Finds the places money slips away in `month`. Each leak says how much it cost
// this month, what that is per year, and how much could realistically be saved.
//   kind: subscriptions | duplicate | small | jump | fees

export function findLeaks(allTxns, month) {
  const txns = inMonth(allTxns, month).filter((t) => t.type === 'expense')
  const prev = inMonth(allTxns, addMonths(month, -1)).filter((t) => t.type === 'expense')
  const leaks = []

  // 1. Recurring charges: same merchant, similar amount, in 2+ of the last 3 months,
  //    plus anything categorized as a subscription this month.
  // Bills you need (rent, utilities, phone, insurance, car payment) recur too,
  // but they aren't leaks, so only "wants" count here.
  const recurring = findRecurring(allTxns, month).filter((r) => cat(r.category).group === 'wants' && r.category !== 'fees')
  const subs = new Map()
  for (const r of recurring) subs.set(r.key, r)
  for (const t of txns) {
    if (t.category !== 'subscriptions') continue
    const key = merchantKey(t.description)
    if (!subs.has(key)) subs.set(key, { key, name: prettyMerchant(key), amount: t.amount, months: 1, lastDate: t.date })
  }
  const subList = [...subs.values()].filter((s) => txns.some((t) => merchantKey(t.description) === s.key))
  if (subList.length) {
    const monthly = subList.reduce((sum, s) => sum + s.amount, 0)
    leaks.push({
      id: 'subscriptions',
      kind: 'subscriptions',
      emoji: '🔁',
      title: `${subList.length} recurring charge${subList.length > 1 ? 's' : ''}`,
      detail: 'Streaming, apps, memberships and other bills that renew on their own. Cancel the ones you forgot about.',
      monthly,
      savable: Math.round(monthly * 0.5),
      items: subList
        .sort((a, b) => b.amount - a.amount)
        .map((s) => ({ label: s.name, amount: s.amount, note: s.months > 1 ? `charged ${s.months} months in a row` : 'this month' })),
    })
  }

  // 2. Possible double charges: same merchant + same amount within 3 days.
  const dupes = []
  const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date))
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]
      const b = sorted[j]
      if (daysBetween(a.date, b.date) > 3) break
      if (a.amount === b.amount && a.amount >= 500 && merchantKey(a.description) === merchantKey(b.description) && !['eating_out', 'coffee', 'convenience', 'gas', 'groceries'].includes(a.category)) {
        dupes.push({ label: prettyMerchant(merchantKey(a.description)), amount: a.amount, note: `${a.date} and ${b.date}` })
      }
    }
  }
  if (dupes.length) {
    const monthly = dupes.reduce((s, d) => s + d.amount, 0)
    leaks.push({
      id: 'duplicates',
      kind: 'duplicate',
      emoji: '👯',
      title: `Possible double charge${dupes.length > 1 ? 's' : ''}`,
      detail: 'Same place, same amount, a few days apart. Check your bank app; if it was a mistake, the merchant or bank can refund it.',
      monthly,
      savable: monthly,
      items: dupes,
    })
  }

  // 3. Small purchases that add up (fast food, gas station snacks, coffee, and
  //    any merchant visited 4+ times with an average under $25).
  const smallByCat = new Map()
  for (const t of txns) {
    if (!cat(t.category).smallLeak || t.amount > 4000) continue
    const row = smallByCat.get(t.category) || { total: 0, count: 0, merchants: new Map() }
    row.total += t.amount
    row.count += 1
    const k = merchantKey(t.description)
    row.merchants.set(k, (row.merchants.get(k) || 0) + t.amount)
    smallByCat.set(t.category, row)
  }
  for (const [id, row] of smallByCat) {
    if (row.count < 3 || row.total < 2500) continue
    const c = cat(id)
    const avg = Math.round(row.total / row.count)
    leaks.push({
      id: `small-${id}`,
      kind: 'small',
      emoji: c.emoji,
      title: `${c.label}: ${row.count} trips`,
      detail: `About ${fmtDollars(avg)} each time. Small buys feel free, but they stack up fast.`,
      monthly: row.total,
      savable: Math.round(row.total * 0.5),
      category: id,
      items: [...row.merchants]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, amt]) => ({ label: prettyMerchant(k), amount: amt })),
    })
  }
  const frequent = new Map()
  for (const t of txns) {
    if (cat(t.category).smallLeak || ['groceries', 'gas', 'housing', 'utilities', 'subscriptions', 'fees', 'transfer', 'savings', 'debt'].includes(t.category)) continue
    const k = merchantKey(t.description)
    const row = frequent.get(k) || { total: 0, count: 0, category: t.category }
    row.total += t.amount
    row.count += 1
    frequent.set(k, row)
  }
  for (const [k, row] of frequent) {
    if (row.count < 4 || row.total / row.count > 2500) continue
    leaks.push({
      id: `frequent-${k}`,
      kind: 'small',
      emoji: cat(row.category).emoji,
      title: `${prettyMerchant(k)}: ${row.count} visits`,
      detail: 'Lots of small trips to the same place.',
      monthly: row.total,
      savable: Math.round(row.total * 0.5),
      category: row.category,
      items: [],
    })
  }

  // 4. Categories that jumped vs last month (up 25%+ and at least $40 more).
  if (prev.length) {
    const before = new Map(byCategory(prev).map((r) => [r.id, r.total]))
    for (const r of byCategory(txns)) {
      if (['housing', 'savings', 'debt', 'fees', 'subscriptions', 'transfer'].includes(r.id)) continue
      const was = before.get(r.id) || 0
      const diff = r.total - was
      if (diff >= 4000 && (was === 0 ? r.total >= 7500 : diff / was >= 0.25)) {
        leaks.push({
          id: `jump-${r.id}`,
          kind: 'jump',
          emoji: '📈',
          title: `${r.label} jumped${was ? ` ${Math.round((diff / was) * 100)}%` : ''}`,
          detail: `${fmtDollars(was)} last month → ${fmtDollars(r.total)} this month.`,
          monthly: diff,
          savable: diff,
          category: r.id,
          items: [],
        })
      }
    }
  }

  // 5. Fees: overdraft, ATM, late fees, interest. Every dollar here is avoidable.
  const fees = txns.filter((t) => t.category === 'fees')
  if (fees.length) {
    const monthly = fees.reduce((s, t) => s + t.amount, 0)
    leaks.push({
      id: 'fees',
      kind: 'fees',
      emoji: '⚠️',
      title: `${fees.length} fee${fees.length > 1 ? 's' : ''} and interest charge${fees.length > 1 ? 's' : ''}`,
      detail: 'Overdraft, ATM, late fees and interest. Low-balance alerts, autopay and in-network ATMs stop most of these.',
      monthly,
      savable: monthly,
      items: fees.map((t) => ({ label: t.description, amount: t.amount, note: t.date })),
    })
  }

  return leaks
    .map((l) => ({ ...l, yearly: l.monthly * 12, yearlySavable: l.savable * 12 }))
    .sort((a, b) => b.savable - a.savable)
}

// Merchants charged a similar amount in 2+ of the 3 months ending at `month`.
export function findRecurring(allTxns, month) {
  const months = [addMonths(month, -2), addMonths(month, -1), month]
  const seen = new Map()
  for (const t of allTxns) {
    if (t.type !== 'expense') continue
    const m = monthKey(t.date)
    if (!months.includes(m)) continue
    if (['groceries', 'gas', 'eating_out', 'coffee', 'convenience', 'shopping', 'transfer'].includes(t.category)) continue
    const k = merchantKey(t.description)
    const row = seen.get(k) || { key: k, charges: [] }
    row.charges.push(t)
    seen.set(k, row)
  }
  const out = []
  for (const row of seen.values()) {
    const ms = new Set(row.charges.map((c) => monthKey(c.date)))
    if (ms.size < 2) continue
    const amounts = row.charges.map((c) => c.amount)
    const max = Math.max(...amounts)
    const min = Math.min(...amounts)
    if (max - min > Math.max(300, max * 0.15)) continue
    const latest = row.charges.sort((a, b) => b.date.localeCompare(a.date))[0]
    out.push({
      key: row.key,
      name: prettyMerchant(row.key),
      amount: latest.amount,
      months: ms.size,
      lastDate: latest.date,
      category: latest.category,
    })
  }
  return out
}

function fmtDollars(cents) {
  return '$' + Math.round(cents / 100).toLocaleString('en-US')
}

// Predicts recurring charges due in the next `days` days (bills and subscriptions),
// from the last time each one was charged.
export function upcomingCharges(allTxns, today, days = 14) {
  const month = today.slice(0, 7)
  const out = []
  for (const r of findRecurring(allTxns, month)) {
    let next = addMonthsToDate(r.lastDate, 1)
    while (next < today) next = addMonthsToDate(next, 1)
    const inDays = daysBetween(today, next)
    if (inDays <= days) out.push({ ...r, next, inDays })
  }
  return out.sort((a, b) => a.inDays - b.inDays)
}

function addMonthsToDate(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const last = new Date(y, m - 1 + n + 1, 0).getDate()
  const dt = new Date(y, m - 1 + n, Math.min(d, last))
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

import Dexie from 'dexie'
import { merchantKey } from './lib/categorize.js'
import { sanitizeGoal, sanitizeTxn } from './lib/sanitize.js'

// Everything lives in this browser's IndexedDB. Nothing is sent to a server.
export const db = new Dexie('money-leak-finder')
db.version(1).stores({
  transactions: '++id, date, type, category, source',
  rules: 'merchant',
  goals: '++id, createdAt',
  settings: 'key',
})

// Last line of defense: anything written to transactions is cleaned and masked,
// even if a future code path forgets to.
db.transactions.hook('creating', (_pk, obj) => {
  const clean = sanitizeTxn(obj)
  if (!clean) throw new Error('Invalid transaction')
  for (const k of Object.keys(obj)) if (!(k in clean) && k !== 'id') delete obj[k]
  Object.assign(obj, clean)
})
db.transactions.hook('updating', (mods, _pk, obj) => {
  const clean = sanitizeTxn({ ...obj, ...mods })
  if (!clean) throw new Error('Invalid transaction')
  const out = {}
  for (const k of Object.keys(mods)) out[k] = clean[k]
  return out
})

export async function getRules() {
  const rows = await db.rules.toArray()
  return Object.fromEntries(rows.map((r) => [r.merchant, r.category]))
}

export async function addTransactions(list) {
  const rules = await getRules()
  const clean = list.map((t) => sanitizeTxn(t, rules)).filter(Boolean)
  if (clean.length) await db.transactions.bulkAdd(clean)
  return clean.length
}

// Skips rows already saved (same date, amount, type and merchant).
export async function addWithoutDuplicates(list) {
  const rules = await getRules()
  const clean = list.map((t) => sanitizeTxn(t, rules)).filter(Boolean)
  if (!clean.length) return { added: 0, duplicates: 0 }
  const dates = [...new Set(clean.map((t) => t.date))]
  const existing = await db.transactions.where('date').anyOf(dates).toArray()
  const seen = new Set(existing.map(sig))
  const fresh = []
  for (const t of clean) {
    const s = sig(t)
    if (seen.has(s)) continue
    seen.add(s)
    fresh.push(t)
  }
  if (fresh.length) await db.transactions.bulkAdd(fresh)
  return { added: fresh.length, duplicates: clean.length - fresh.length }
}

const sig = (t) => `${t.date}|${t.amount}|${t.type}|${merchantKey(t.description)}`

// Re-categorize one transaction; optionally remember the choice for this merchant
// and apply it to every other transaction from the same place.
export async function recategorize(txn, category, remember = true) {
  await db.transaction('rw', db.transactions, db.rules, async () => {
    await db.transactions.update(txn.id, { category })
    if (!remember) return
    const key = merchantKey(txn.description)
    await db.rules.put({ merchant: key, category })
    const same = await db.transactions.where('type').equals(txn.type).filter((t) => merchantKey(t.description) === key).toArray()
    for (const t of same) if (t.category !== category) await db.transactions.update(t.id, { category })
  })
}

export async function saveGoal(goal, id) {
  const clean = sanitizeGoal(goal)
  if (!clean) throw new Error('Please enter an amount greater than $0.')
  if (id) await db.goals.update(id, clean)
  else await db.goals.add(clean)
}

export async function getSetting(key, fallback = null) {
  const row = await db.settings.get(key)
  return row ? row.value : fallback
}

export function setSetting(key, value) {
  return db.settings.put({ key, value })
}

export async function wipeEverything() {
  await db.delete()
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('mlf.')) localStorage.removeItem(k)
  } catch {}
  if ('caches' in window) {
    for (const k of await caches.keys()) await caches.delete(k)
  }
}

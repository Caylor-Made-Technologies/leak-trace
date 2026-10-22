import { categorize } from './categorize.js'
import { isValidCategory } from './categories.js'
import { isValidISO } from './dates.js'
import { MAX_CENTS } from './money.js'
import { cleanText } from './privacy.js'

const SOURCES = ['manual', 'csv', 'screenshot', 'demo', 'backup']

// Normalizes one transaction from any source (typed in, CSV, screenshot, backup).
// Returns null if it can't be made valid. Never trusts the input.
export function sanitizeTxn(input, merchantRules = {}) {
  if (!input || typeof input !== 'object') return null
  const type = input.type === 'income' ? 'income' : input.type === 'expense' ? 'expense' : null
  const amount = Number.isInteger(input.amount) ? Math.abs(input.amount) : null
  if (!type || !amount || amount > MAX_CENTS) return null
  if (!isValidISO(input.date)) return null
  const description = cleanText(input.description, 80) || 'Unknown'
  let category = typeof input.category === 'string' && isValidCategory(input.category, type) ? input.category : null
  if (!category) category = categorize({ description, amount, type }, merchantRules)
  const out = {
    date: input.date,
    description,
    amount,
    type,
    category,
    source: SOURCES.includes(input.source) ? input.source : 'manual',
    createdAt: Number.isFinite(input.createdAt) ? input.createdAt : Date.now(),
  }
  const note = cleanText(input.note, 140)
  if (note) out.note = note
  return out
}

export function sanitizeGoal(input) {
  if (!input || typeof input !== 'object') return null
  const target = Number.isInteger(input.target) ? input.target : null
  if (!target || target <= 0 || target > MAX_CENTS) return null
  const saved = Number.isInteger(input.saved) && input.saved >= 0 ? Math.min(input.saved, MAX_CENTS) : 0
  return {
    name: cleanText(input.name, 40) || 'My goal',
    emoji: typeof input.emoji === 'string' && [...input.emoji].length <= 4 ? input.emoji : '🎯',
    target,
    saved,
    targetDate: isValidISO(input.targetDate) ? input.targetDate : null,
    createdAt: Number.isFinite(input.createdAt) ? input.createdAt : Date.now(),
  }
}

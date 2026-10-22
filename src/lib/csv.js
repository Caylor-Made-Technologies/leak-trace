import Papa from 'papaparse'
import { parseDate } from './dates.js'
import { parseAmount } from './money.js'
import { cleanText } from './privacy.js'

export const MAX_CSV_BYTES = 5 * 1024 * 1024
export const MAX_ROWS = 5000

const COLS = {
  date: ['date', 'transaction date', 'posted date', 'posting date', 'post date', 'trans date', 'effective date'],
  description: ['description', 'memo', 'payee', 'name', 'details', 'merchant', 'transaction description', 'original description', 'narrative'],
  amount: ['amount', 'transaction amount', 'amt', 'value'],
  debit: ['debit', 'debits', 'withdrawal', 'withdrawals', 'money out', 'paid out', 'debit amount', 'out'],
  credit: ['credit', 'credits', 'deposit', 'deposits', 'money in', 'paid in', 'credit amount', 'in'],
  type: ['type', 'transaction type', 'in/out', 'credit/debit', 'debit/credit', 'dr/cr', 'cr/dr', 'direction'],
}

// Columns we never read, even if present.
const BLOCKED = /account|acct|routing|card ?(number|no)|ssn|social|check ?number|balance/i

function norm(h) {
  return String(h || '').toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function detectColumns(headers) {
  const map = {}
  const normalized = headers.map(norm)
  for (const [field, names] of Object.entries(COLS)) {
    let idx = normalized.findIndex((h) => names.includes(h) && !BLOCKED.test(h))
    if (idx < 0 && field !== 'type') idx = normalized.findIndex((h) => names.some((n) => n.length > 3 && h.includes(n)) && !BLOCKED.test(h))
    if (idx >= 0) map[field] = headers[idx]
  }
  return map
}

// Parses a bank CSV export into { rows, skipped, mapping }.
// Each row: { date, description, amount (positive cents), type }
export function parseBankCsv(text) {
  if (text.length > MAX_CSV_BYTES) throw new Error('That file is too big (5 MB max).')
  const parsed = Papa.parse(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: 'greedy' })
  let headers = parsed.meta.fields || []
  let data = parsed.data
  let mapping = detectColumns(headers)

  // Some banks skip the header row: try date, description, amount positions.
  if (!mapping.date && data.length) {
    const raw = Papa.parse(text, { header: false, skipEmptyLines: 'greedy' }).data
    if (raw.length && parseDate(raw[0][0])) {
      headers = raw[0].map((_, i) => `col${i}`)
      data = raw.map((r) => Object.fromEntries(r.map((v, i) => [`col${i}`, v])))
      const amountCol = headers.findIndex((h, i) => i > 0 && raw.slice(0, 5).every((r) => parseAmount(r[i]) != null))
      const descCol = headers.findIndex((h, i) => i > 0 && i !== amountCol && raw.slice(0, 5).some((r) => /[a-z]/i.test(r[i] || '')))
      mapping = { date: 'col0', amount: headers[amountCol], description: headers[descCol] }
    }
  }

  if (!mapping.date || !(mapping.amount || mapping.debit || mapping.credit)) {
    throw new Error("Couldn't find date and amount columns. Make sure the file has a header row like Date, Description, Amount.")
  }

  const rows = []
  let skipped = 0
  for (const r of data.slice(0, MAX_ROWS)) {
    const date = parseDate(r[mapping.date])
    let cents = null
    let type = null
    if (mapping.debit || mapping.credit) {
      const d = parseAmount(r[mapping.debit])
      const c = parseAmount(r[mapping.credit])
      if (d) { cents = Math.abs(d); type = 'expense' }
      else if (c) { cents = Math.abs(c); type = 'income' }
    }
    if (cents == null && mapping.amount) {
      const a = parseAmount(r[mapping.amount])
      if (a != null && a !== 0) {
        cents = Math.abs(a)
        type = a < 0 ? 'expense' : 'income'
        const t = mapping.type ? norm(r[mapping.type]) : ''
        if (/^(debit|dr|withdrawal|out|expense|purchase|payment|sale|fee)/.test(t)) type = 'expense'
        else if (/^(credit|cr|deposit|in|income|refund|return)/.test(t)) type = 'income'
      }
    }
    if (!date || !cents || !type) { skipped++; continue }
    rows.push({ date, description: cleanText(r[mapping.description] || 'Unknown') || 'Unknown', amount: cents, type })
  }
  skipped += Math.max(0, data.length - MAX_ROWS)

  // Many banks list every amount as positive with spending as the norm. If the
  // file had no sign/type info and everything came out as income, flip to expense.
  if (mapping.amount && !mapping.type && !mapping.debit && rows.length > 3 && rows.every((r) => r.type === 'income')) {
    for (const r of rows) {
      if (!/payroll|deposit|direct dep|salary|refund|paycheck/i.test(r.description)) r.type = 'expense'
    }
  }
  return { rows, skipped, mapping }
}

// Spreadsheet-safe CSV export: cells starting with = + - @ get a leading quote
// so a spreadsheet won't run them as formulas.
export function toCsv(txns) {
  const esc = (v) => {
    if (typeof v === 'number') return String(v)
    let s = String(v ?? '')
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [['Date', 'Description', 'Category', 'Type', 'Amount'].join(',')]
  for (const t of txns) {
    lines.push([t.date, t.description, t.category, t.type, (t.type === 'expense' ? -t.amount : t.amount) / 100].map(esc).join(','))
  }
  return lines.join('\n')
}

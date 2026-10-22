// All money is stored as whole cents (integers) to avoid rounding bugs.

export const MAX_CENTS = 100_000_000_00 // $100M cap on any single amount

export function toCents(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return Math.round(value * 100)
  }
  return parseAmount(value)
}

// Parses "$1,234.56", "-12.00", "(45.10)", "12.00-", "USD 9.99" into cents.
// Returns null when there is no usable number. Sign is kept (negative = money out).
export function parseAmount(input) {
  if (input == null) return null
  let s = String(input).trim()
  if (!s) return null
  let negative = false
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1) }
  if (/-\s*$/.test(s)) { negative = true; s = s.replace(/-\s*$/, '') }
  if (/^\s*-/.test(s) || /^\s*[$€£]?\s*-/.test(s)) negative = true
  s = s.replace(/[^0-9.,]/g, '')
  if (!s) return null
  // "1.234,56" (comma decimal) → "1234.56"
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(/,/g, '')
  if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return null
  const n = Math.round(parseFloat(s) * 100)
  if (!Number.isFinite(n) || n > MAX_CENTS) return null
  return negative ? -n : n
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const fmt0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function formatMoney(cents, { whole = false } = {}) {
  const v = (cents || 0) / 100
  return whole ? fmt0.format(Math.round(v)) : fmt.format(v)
}

// Short form for tight spaces: $1.2k, $35k, $1.4M
export function formatShort(cents) {
  const v = Math.abs((cents || 0) / 100)
  const sign = cents < 0 ? '-' : ''
  if (v >= 1_000_000) return `${sign}$${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`
  if (v >= 10_000) return `${sign}$${Math.round(v / 1000)}k`
  if (v >= 1000) return `${sign}$${(v / 1000).toFixed(1)}k`
  return `${sign}$${Math.round(v)}`
}

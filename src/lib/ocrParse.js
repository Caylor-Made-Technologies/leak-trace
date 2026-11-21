// Turns the text read from a screenshot (on the phone, see ocr.js) into transactions.
// Pure functions: no browser, no network. The output has the same shape the old cloud
// reader returned, so it goes through the same checks (normalizeExtraction) and the
// same review screen, where every row can be fixed before it's saved.
//
//   pay stub  -> one money-in row for NET pay (what reaches the bank)
//   receipt   -> one money-out row for the TOTAL
//   bank list -> one row per transaction line
import { looksSensitive } from './privacy.js'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad = (n) => String(n).padStart(2, '0')
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`

/** Common OCR slips inside numbers (O for 0, l/I for 1, S for 5, B for 8): only letters touching a digit,
 *  a decimal point or a $ are changed, so words like SHELL or OVERDRAFT are left alone. */
export function fixDigits(s) {
  let out = String(s), prev
  do {
    prev = out
    out = out.replace(/(?<=[\d$])[OoIlSB]|(?<=\d[.,])[OoIlSB]|[OoIlSB](?=\d)|[OoIlSB](?=[.,]\d)/g, (c) => ({ O: '0', o: '0', I: '1', l: '1', S: '5', B: '8' })[c])
  } while (out !== prev)
  return out
}

// $1,685.40  -$40.00  ($9.41)  + 12.00  1 685,40  9.41-   (cents required: keeps years, counts and phone numbers out)
const AMOUNT = /([-−–+]\s?)?(\()?\$?\s?(\d{1,3}(?:[, ]\d{3})+|\d+)[.,](\d{2})(?!\d)(\))?(\s?-|\s?CR\b|\s?DR\b)?/gi

// A dollar amount whose decimal point the reader lost: "-$4512" for -$45.12 (3+ digits, no separators).
const LOST_POINT = /([-−–+]\s?)?\$(\d{3,7})(?![\d.,])/g

/** Every money amount in a line, in order: { cents, sign: -1 | 0 | 1, index, guessed? } (sign 0 = not shown). */
export function findAmounts(line) {
  const text = fixDigits(line)
  const out = []
  if (!/[.,]\d{2}(?!\d)/.test(text)) {
    for (const m of text.matchAll(LOST_POINT)) {
      const pre = (m[1] || '').trim()
      out.push({ cents: Number(m[2]), sign: pre === '+' ? 1 : pre ? -1 : 0, index: m.index, length: m[0].length, guessed: true })
    }
    if (out.length) return out
  }
  for (const m of text.matchAll(AMOUNT)) {
    const whole = m[3].replace(/[, ]/g, '')
    const cents = Number(whole) * 100 + Number(m[4])
    if (!Number.isFinite(cents) || cents <= 0 || cents >= 100_000_000) continue
    const pre = (m[1] || '').trim()
    const post = (m[6] || '').trim().toUpperCase()
    let sign = 0
    if (pre === '+' || post === 'CR') sign = 1
    if (/[-−–]/.test(pre) || (m[2] && m[5]) || post === '-' || post === 'DR') sign = -1
    out.push({ cents, sign, index: m.index, length: m[0].length })
  }
  return out
}

/** The date in a line as YYYY-MM-DD, or null. Years left out are the most recent past one. */
export function findDate(line, today) {
  const t = fixDigits(String(line)).toLowerCase()
  const [ty, tm, td] = today.split('-').map(Number)
  const now = Date.UTC(ty, tm - 1, td)
  const pick = (m, d, y) => {
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null
    if (y != null) {
      if (y < 100) y += 2000
      return y >= 1990 && y <= ty + 1 ? iso(y, m, d) : null
    }
    // No year: this year, unless that would be more than 2 days in the future.
    const guess = Date.UTC(ty, m - 1, d)
    return iso(guess - now > 2 * 864e5 ? ty - 1 : ty, m, d)
  }
  if (/\btoday\b/.test(t)) return today
  if (/\byesterday\b/.test(t)) { const y = new Date(now - 864e5); return iso(y.getUTCFullYear(), y.getUTCMonth() + 1, y.getUTCDate()) }
  let m = t.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/)
  if (m) return pick(+m[2], +m[3], +m[1])
  m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)
  if (m) return pick(+m[1], +m[2], m[3] != null ? +m[3] : null)
  m = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/)
  if (m) return pick(MONTHS.indexOf(m[1].slice(0, 3)) + 1, +m[2], m[3] ? +m[3] : null)
  m = t.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+(\d{4}))?\b/)
  if (m) return pick(MONTHS.indexOf(m[2]) + 1, +m[1], m[3] ? +m[3] : null)
  return null
}

const words = (s) => (String(s).match(/[a-z]{2,}/gi) || []).length
/** A line that is only a date heading ("Today", "Thursday, Nov 20"). */
const isDateHeading = (line, today) => findDate(line, today) && !findAmounts(line).length && words(String(line).replace(/\b(today|yesterday|mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi, '')) === 0

/** The merchant / description left after taking out amounts, dates and app chrome. */
export function describe(line) {
  return fixDigits(line)
    .replace(AMOUNT, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b|\b20\d{2}-\d{1,2}-\d{1,2}\b/g, ' ')
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(,?\s+\d{4})?\b/gi, ' ')
    .replace(/\b(pending|posted|completed|today|yesterday)\b/gi, ' ')
    .replace(/[|•·>›»<‹«©®™_=*~^]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—:.,]+|[\s\-–—:.,]+$/g, '')
    .trim()
}

const PAY = /net pay|gross pay|pay period|pay date|check date|earnings|deductions|\bytd\b|year to date|federal (income )?tax|fed(eral)? withholding|fica|medicare|social security|oasdi|direct deposit|take home/i
const RECEIPT = /sub ?total|\btotal\b|\btax\b|change due|\bcash\b|\bvisa\b|mastercard|\bdebit\b|approved|thank you|receipt|\bqty\b|tender|\bitems?\b|auth(orization)? ?#?|store ?#/i
const SKIP_BANK = /balance|available|credit limit|statement|minimum payment|payment due|interest rate|apr\b|rewards|points|spent this|total spent|budget|account ending/i
const INCOME = /deposit|payroll|direct dep|paycheck|salary|refund|reversal|interest (paid|earned)|cash ?back|transfer from|zelle from|from .* via|venmo from|received|credit adj/i

/** What kind of screenshot this is, from its words. */
export function detectType(lines) {
  const all = lines.join('\n')
  const payHits = lines.filter((l) => PAY.test(l)).length
  if (/net pay|take home|net amount/i.test(all) && payHits >= 2) return 'pay_stub'
  const receiptHits = lines.filter((l) => RECEIPT.test(l)).length
  const totalLine = lines.some((l) => /^\W*(grand\s+)?total\b|amount due|balance due|total due/i.test(l))
  const datedAmountLines = lines.filter((l) => findAmounts(l).length).length
  if (totalLine && receiptHits >= 2 && !/pending|posted/i.test(all)) return 'receipt'
  return datedAmountLines ? 'bank_list' : 'other'
}

function confidenceOf(conf, hasDate) {
  if (conf >= 85 && hasDate) return 'high'
  if (conf >= 65) return 'medium'
  return 'low'
}

/**
 * @param {{ text: string, conf?: number }[] | string[]} input lines top to bottom (conf 0-100 from the reader)
 * @param {{ today: string }} opts
 * @returns {{ document_type: string, masked_numbers: boolean, transactions: object[] }}
 */
export function parseScreenshot(input, { today }) {
  const lines = (input || []).map((l) => (typeof l === 'string' ? { text: l, conf: 90 } : { text: String(l.text || ''), conf: Number.isFinite(l.conf) ? l.conf : 70 }))
    .map((l) => ({ ...l, text: l.text.replace(/\s+/g, ' ').trim() }))
    .filter((l) => l.text)
  const texts = lines.map((l) => l.text)
  const type = detectType(texts)
  // Numbers the screenshot already shows masked (****4242) don't count; only real ones we had to hide.
  const masked = texts.some((t) => looksSensitive(t.replace(/[*•xX#]{2,}\s?\d{2,4}\b/g, '')))
  const anyDate = texts.map((t) => findDate(t, today)).find(Boolean) || null
  const tx = []

  if (type === 'pay_stub') {
    // Net pay: on its own line or the next one. With current + YTD columns, the first is this period.
    let cents = 0, conf = 60
    for (let i = 0; i < lines.length && !cents; i++) {
      if (!/net pay|take home|net amount|net check/i.test(lines[i].text)) continue
      const a = findAmounts(lines[i].text)[0] || findAmounts(lines[i + 1]?.text || '')[0]
      if (a) { cents = a.cents; conf = lines[i].conf }
    }
    const dateLine = texts.find((t) => /pay date|check date|deposit date|pay day/i.test(t))
    const periodEnd = texts.find((t) => /period (end|ending)|pay period|period:/i.test(t))
    const date = (dateLine && findDate(dateLine.replace(/^.*?(pay date|check date|deposit date|pay day)/i, ''), today))
      || (periodEnd && findDate(periodEnd.split(/\bto\b|-|–/).pop(), today)) || anyDate
    if (cents) tx.push({ date, merchant: 'Paycheck', amount: cents / 100, type: 'income', category_hint: 'paycheck', confidence: confidenceOf(conf, !!date) })
  } else if (type === 'receipt') {
    const totals = lines.filter((l) => /^\W*(grand\s+)?total\b|amount due|balance due|total due|total sale/i.test(l.text) && !/sub ?total|total (savings|discount|tax|items?)/i.test(l.text))
    let best = null
    for (const l of totals) for (const a of findAmounts(l.text)) if (!best || a.cents > best.cents) best = { ...a, conf: l.conf }
    if (!best) {
      // No total line read: the biggest amount on the receipt is the safest guess, marked low.
      for (const l of lines) for (const a of findAmounts(l.text)) if (!best || a.cents > best.cents) best = { ...a, conf: 40 }
    }
    const name = lines.slice(0, 6).map((l) => describe(l.text)).find((d) => words(d) >= 1 && d.replace(/[^a-z]/gi, '').length >= 3 && !/receipt|welcome|thank|store|tel|phone|www|\.com|street|st\.|ave|road|rd\.|blvd|suite/i.test(d) && !/\d{3}.*\d{4}/.test(d))
    if (best) tx.push({ date: anyDate, merchant: name || 'Receipt', amount: best.cents / 100, type: 'expense', category_hint: null, confidence: confidenceOf(best.conf, !!anyDate) })
  } else if (type === 'bank_list') {
    // Apps either group rows under date headings ("Today", "Nov 18") or print a date on/under each row.
    const firstAmount = lines.findIndex((l) => findAmounts(l.text).length && !SKIP_BANK.test(l.text))
    const usesHeadings = lines.some((l, i) => i < firstAmount && isDateHeading(l.text, today))
    let heading = null
    let lastText = null // { text, i } a description line waiting for its amount
    lines.forEach((l, i) => {
      if (isDateHeading(l.text, today)) { heading = findDate(l.text, today); return }
      const amounts = findAmounts(l.text)
      if (!amounts.length) {
        if (words(l.text) >= 1 && !SKIP_BANK.test(l.text)) lastText = { text: describe(l.text), i }
        return
      }
      if (SKIP_BANK.test(l.text)) return
      const a = amounts[0] // a second amount on the line is usually the running balance
      let merchant = describe(l.text)
      if (words(merchant) < 1 && lastText && i - lastText.i <= 2) merchant = lastText.text
      lastText = null
      if (words(merchant) < 1) return
      const below = lines[i + 1]?.text || ''
      const date = findDate(l.text, today) || (!usesHeadings && !findAmounts(below).length ? findDate(below, today) : null) || heading
      const type = a.sign > 0 || (a.sign === 0 && INCOME.test(l.text + ' ' + merchant)) ? 'income' : 'expense'
      tx.push({ date, merchant, amount: a.cents / 100, type, category_hint: null, confidence: a.guessed ? 'low' : confidenceOf(l.conf, !!date) })
    })
  }
  return { document_type: type, masked_numbers: masked, transactions: tx }
}

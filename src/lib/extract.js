import { categoryFromHint } from './categorize.js'
import { isValidISO, todayISO } from './dates.js'
import { toCents } from './money.js'
import { cleanText, looksSensitive } from './privacy.js'

// Treats what was read from a screenshot as untrusted: validates every field, masks numbers again.
export function normalizeExtraction(body) {
  const list = Array.isArray(body?.transactions) ? body.transactions.slice(0, 200) : []
  const today = todayISO()
  return {
    documentType: ['pay_stub', 'bank_list', 'receipt', 'other'].includes(body?.document_type) ? body.document_type : 'other',
    masked: !!body?.masked_numbers,
    rows: list.map((t, i) => {
      const type = t?.type === 'income' ? 'income' : 'expense'
      const raw = String(t?.merchant ?? '')
      const cents = Math.abs(toCents(Number(t?.amount)) || 0)
      return {
        key: i,
        include: cents > 0,
        date: isValidISO(t?.date) ? t.date : today,
        dateGuessed: !isValidISO(t?.date),
        description: cleanText(raw) || 'Unknown',
        hadNumber: looksSensitive(raw),
        amount: cents,
        type,
        category: categoryFromHint(t?.category_hint, type),
        confidence: ['high', 'medium', 'low'].includes(t?.confidence) ? t.confidence : 'medium',
      }
    }).filter((r) => r.amount > 0),
  }
}

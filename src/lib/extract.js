import { categoryFromHint } from './categorize.js'
import { isValidISO, todayISO } from './dates.js'
import { toCents } from './money.js'
import { cleanText, looksSensitive } from './privacy.js'

export const API_URL = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '')
export const extractionEnabled = () => !!API_URL

// Sends prepared screenshots to the reader (our Cloudflare Worker, which holds the
// API key). Returns rows for the review screen. Nothing is stored on the server.
export async function extractFromImages(images, { signal } = {}) {
  if (!API_URL) throw new Error('Screenshot reading isn’t set up on this copy of the app yet.')
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 90_000)
  signal?.addEventListener('abort', () => ctl.abort())
  let res
  try {
    res = await fetch(`${API_URL}/extract`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ images: images.map(({ media_type, data }) => ({ media_type, data })) }),
      signal: ctl.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    })
  } catch (e) {
    if (ctl.signal.aborted) throw new Error('That took too long. Try fewer screenshots at once.')
    throw new Error('Couldn’t reach the reader. Check your connection.')
  } finally {
    clearTimeout(timer)
  }
  let body = null
  try { body = await res.json() } catch {}
  if (!res.ok) throw new Error(body?.error && typeof body.error === 'string' ? body.error.slice(0, 200) : 'The reader had a problem. Try again.')
  return normalizeExtraction(body)
}

// Treats the reader's answer as untrusted: validates every field, masks numbers again.
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

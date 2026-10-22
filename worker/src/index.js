import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { maskSensitive } from '../../src/lib/privacy.js'
import { CATEGORY_HINTS, SYSTEM_PROMPT } from './prompt.js'
import { InputError, MAX_BODY_BYTES, parseOrigins, validateImages } from './validate.js'

// Money Leak Finder screenshot reader.
// The AI API key lives only here (a Worker secret), never in the app.
// Images and results are never stored or logged.

const Extraction = z.object({
  document_type: z.enum(['pay_stub', 'bank_list', 'receipt', 'other']),
  contained_sensitive_numbers: z.boolean(),
  transactions: z.array(z.object({
    date: z.string(),
    merchant: z.string(),
    amount: z.number(),
    type: z.enum(['income', 'expense']),
    category_hint: z.enum(CATEGORY_HINTS),
    confidence: z.enum(['high', 'medium', 'low']),
  })),
})

const SECURITY_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
}

function json(status, body, cors = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...SECURITY_HEADERS, ...cors } })
}

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  }
}

async function hashIp(ip) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`mlf:${ip}`))
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function readLimited(request, limit) {
  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > limit) throw new InputError('Request too large.')
  const reader = request.body?.getReader()
  if (!reader) throw new InputError('Empty request.')
  const chunks = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) { await reader.cancel(); throw new InputError('Request too large.') }
    chunks.push(value)
  }
  const all = new Uint8Array(size)
  let off = 0
  for (const c of chunks) { all.set(c, off); off += c.byteLength }
  return new TextDecoder().decode(all)
}

export function cleanResult(parsed) {
  let masked = !!parsed.contained_sensitive_numbers
  const transactions = parsed.transactions.slice(0, 200).flatMap((t) => {
    const amount = Math.round(Math.abs(Number(t.amount)) * 100) / 100
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return []
    const merchant = maskSensitive(String(t.merchant)).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80)
    if (merchant !== String(t.merchant).trim().slice(0, 80)) masked = true
    return [{
      date: /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : '',
      merchant: merchant || 'Unknown',
      amount,
      type: t.type,
      category_hint: t.category_hint,
      confidence: t.confidence,
    }]
  })
  return { document_type: parsed.document_type, masked_numbers: masked, transactions }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = request.headers.get('origin') || ''
    const allowed = parseOrigins(env.ALLOWED_ORIGINS)
    const cors = allowed.includes(origin) ? corsHeaders(origin) : {}

    if (url.pathname === '/health') return json(200, { ok: true })
    if (url.pathname !== '/extract') return json(404, { error: 'Not found.' })
    if (!allowed.includes(origin)) return json(403, { error: 'This site is not allowed to use the reader.' })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, ...SECURITY_HEADERS } })
    if (request.method !== 'POST') return json(405, { error: 'Use POST.' }, cors)
    if (!(request.headers.get('content-type') || '').startsWith('application/json')) return json(415, { error: 'Send JSON.' }, cors)

    const ip = request.headers.get('cf-connecting-ip') || 'unknown'
    if (env.RATE_LIMITER) {
      const { success } = await env.RATE_LIMITER.limit({ key: await hashIp(ip) })
      if (!success) return json(429, { error: 'Too many reads at once. Wait a minute and try again.' }, cors)
    }
    if (!env.AI_API_KEY) return json(503, { error: 'The reader isn’t set up yet.' }, cors)

    let images
    try {
      const text = await readLimited(request, MAX_BODY_BYTES)
      let body
      try { body = JSON.parse(text) } catch { throw new InputError('Invalid JSON.') }
      images = validateImages(body)
    } catch (e) {
      if (e instanceof InputError) return json(400, { error: e.message }, cors)
      throw e
    }

    const client = new Anthropic({ apiKey: env.AI_API_KEY, maxRetries: 1, timeout: 80_000 })
    const today = new Date().toISOString().slice(0, 10)
    try {
      const response = await client.beta.messages.parse({
        model: env.MODEL || 'claude-opus-5-5',
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: env.EFFORT || 'low', format: betaZodOutputFormat(Extraction) },
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            ...images.map((img) => ({ type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } })),
            { type: 'text', text: `Today's date is ${today}. Extract the transactions from ${images.length === 1 ? 'this screenshot' : `these ${images.length} screenshots`}.` },
          ],
        }],
      })
      if (response.stop_reason === 'refusal') return json(422, { error: 'Those screenshots couldn’t be read. Try a different picture.' }, cors)
      if (!response.parsed_output) return json(502, { error: 'Couldn’t read that clearly. Try a sharper screenshot or fewer at once.' }, cors)
      return json(200, cleanResult(response.parsed_output), cors)
    } catch (e) {
      // Log only the status, never the request or response content.
      const status = e instanceof Anthropic.APIError ? e.status : 'network'
      console.error('extract failed', status)
      if (e instanceof Anthropic.RateLimitError) return json(429, { error: 'The reader is busy. Try again in a minute.' }, cors)
      if (e instanceof Anthropic.BadRequestError) return json(400, { error: 'Those images couldn’t be processed. Try PNG or JPG screenshots.' }, cors)
      return json(502, { error: 'The reader had a problem. Try again.' }, cors)
    }
  },
}

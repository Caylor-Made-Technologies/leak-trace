import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateImages, InputError } from '../src/validate.js'
import worker, { cleanResult } from '../src/index.js'

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]).toString('base64')
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]).toString('base64')

test('accepts valid images, rejects bad ones', () => {
  assert.equal(validateImages({ images: [{ media_type: 'image/png', data: png }] }).length, 1)
  assert.throws(() => validateImages({ images: [] }), InputError)
  assert.throws(() => validateImages({ images: [{ media_type: 'image/png', data: jpg }] }), /match/)
  assert.throws(() => validateImages({ images: [{ media_type: 'image/svg+xml', data: png }] }), InputError)
  assert.throws(() => validateImages({ images: [{ media_type: 'image/png', data: 'not base64!' }] }), InputError)
  assert.throws(() => validateImages({ images: Array(6).fill({ media_type: 'image/png', data: png }) }), InputError)
  assert.throws(() => validateImages({ images: [{ media_type: 'image/png', data: png }], model: 'x' }), /Unexpected/)
})

test('masks numbers the model might return', () => {
  const r = cleanResult({ document_type: 'bank_list', contained_sensitive_numbers: false, transactions: [
    { date: '2026-10-01', merchant: 'Transfer to 123456789012', amount: -50, type: 'expense', category_hint: 'transfer', confidence: 'high' },
    { date: 'yesterday', merchant: 'Sonic', amount: 0, type: 'expense', category_hint: 'eating_out', confidence: 'high' },
  ] })
  assert.equal(r.transactions.length, 1)
  assert.equal(r.transactions[0].merchant, 'Transfer to ••••9012')
  assert.equal(r.transactions[0].amount, 50)
  assert.equal(r.masked_numbers, true)
})

const env = { ALLOWED_ORIGINS: 'https://app.example', AI_API_KEY: '' }
const req = (opts = {}) => new Request('https://api.example/extract', { method: 'POST', headers: { origin: 'https://app.example', 'content-type': 'application/json', ...opts.headers }, body: opts.body ?? JSON.stringify({ images: [{ media_type: 'image/png', data: png }] }) })

test('blocks other sites, wrong methods, and missing key', async () => {
  let r = await worker.fetch(req({ headers: { origin: 'https://evil.example' } }), env)
  assert.equal(r.status, 403)
  assert.equal(r.headers.get('access-control-allow-origin'), null)
  r = await worker.fetch(new Request('https://api.example/extract', { method: 'GET', headers: { origin: 'https://app.example' } }), env)
  assert.equal(r.status, 405)
  r = await worker.fetch(req(), env)
  assert.equal(r.status, 503)
  r = await worker.fetch(req({ headers: { 'content-type': 'text/plain' } }), env)
  assert.equal(r.status, 415)
  r = await worker.fetch(req({ body: 'x'.repeat(100) }), { ...env, AI_API_KEY: 'k' })
  assert.equal(r.status, 400)
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff')
  r = await worker.fetch(req(), { ...env, AI_API_KEY: 'k', RATE_LIMITER: { limit: async () => ({ success: false }) } })
  assert.equal(r.status, 429)
  r = await worker.fetch(new Request('https://api.example/extract', { method: 'OPTIONS', headers: { origin: 'https://app.example' } }), env)
  assert.equal(r.status, 204)
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://app.example')
})
